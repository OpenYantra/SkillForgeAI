/**
 * AST-based symbol extraction built on tree-sitter.
 *
 * Falls back to `heuristic.mjs` when a grammar binding is unavailable so the
 * code graph degrades gracefully instead of crashing.
 */

import fs from 'node:fs';
import { getParser, grammarForFile } from './tree-sitter-loader.mjs';
import { detectLanguage, emptySymbols, extractHeuristic, unquote } from './heuristic.mjs';

export { detectLanguage };

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function nameOf(node) {
  const named = node.childForFieldName('name');
  if (named) return named.text;
  const identifier = node.namedChildren.find((child) => child.type === 'identifier');
  return identifier ? identifier.text : '';
}

function walk(node, visitor) {
  visitor(node);
  for (const child of node.namedChildren) walk(child, visitor);
}

function importSpecOf(node) {
  const source = node.childForFieldName('source');
  return source ? unquote(source.text) : '';
}

function extractTypeScript(root) {
  const symbols = emptySymbols();
  const internalImports = [];

  walk(root, (node) => {
    switch (node.type) {
      case 'class_declaration':
      case 'abstract_class_declaration':
        pushUnique(symbols.classes, nameOf(node));
        break;
      case 'interface_declaration':
        pushUnique(symbols.interfaces, nameOf(node));
        break;
      case 'type_alias_declaration':
        pushUnique(symbols.types, nameOf(node));
        break;
      case 'function_declaration':
        pushUnique(symbols.functions, nameOf(node));
        break;
      case 'import_statement':
      case 'export_statement': {
        const spec = importSpecOf(node);
        if (spec.startsWith('.')) pushUnique(internalImports, spec);
        break;
      }
      case 'call_expression': {
        const fn = node.childForFieldName('function');
        if (fn && fn.type === 'identifier' && fn.text === 'require') {
          const args = node.childForFieldName('arguments');
          const first = args && args.namedChildren.find((child) => child.type === 'string');
          const spec = first ? unquote(first.text) : '';
          if (spec.startsWith('.')) pushUnique(internalImports, spec);
        }
        break;
      }
      default:
        break;
    }
  });

  return { symbols, internalImports };
}

function extractCSharp(root) {
  const symbols = emptySymbols();

  walk(root, (node) => {
    switch (node.type) {
      case 'class_declaration':
      case 'record_declaration':
      case 'struct_declaration':
        pushUnique(symbols.classes, nameOf(node));
        break;
      case 'interface_declaration':
        pushUnique(symbols.interfaces, nameOf(node));
        break;
      default:
        break;
    }
  });

  return { symbols, internalImports: [] };
}

function extractPython(root) {
  const symbols = emptySymbols();
  const internalImports = [];

  walk(root, (node) => {
    switch (node.type) {
      case 'class_definition':
        pushUnique(symbols.classes, nameOf(node));
        break;
      case 'function_definition': {
        const name = nameOf(node);
        if (name && !name.startsWith('__')) pushUnique(symbols.functions, name);
        break;
      }
      case 'import_from_statement': {
        const match = node.text.match(/^from\s+(\.+[\w.]*)\s+import\b/);
        if (match) pushUnique(internalImports, match[1]);
        break;
      }
      default:
        break;
    }
  });

  return { symbols, internalImports };
}

function extractGo(root) {
  const symbols = emptySymbols();

  walk(root, (node) => {
    if (node.type === 'type_declaration') {
      for (const spec of node.namedChildren.filter((child) => child.type === 'type_spec')) {
        const name = nameOf(spec);
        const typeNode = spec.childForFieldName('type');
        if (typeNode && typeNode.type === 'interface_type') pushUnique(symbols.interfaces, name);
        else pushUnique(symbols.classes, name);
      }
      return;
    }
    if (node.type === 'function_declaration' || node.type === 'method_declaration') {
      pushUnique(symbols.functions, nameOf(node));
    }
  });

  return { symbols, internalImports: [] };
}

/**
 * Extract all import sources (bare packages and relative paths) from a file.
 * Used by architecture-boundary validators.
 * @param {string} filePath
 * @returns {{sources: string[], language: string, parser: 'tree-sitter'|'heuristic'}}
 */
export function extractImportSources(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const language = detectLanguage(filePath);
  const grammar = grammarForFile(filePath);
  const parser = grammar ? getParser(grammar) : null;
  const sources = [];
  const add = (value) => {
    if (value && !sources.includes(value)) sources.push(value);
  };

  if (!parser || !grammar) {
    const patterns = [
      /(?:from|import)\s+['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
      /^\s*using\s+([\w.]+)\s*;/gm,
      /^\s*(?:from|import)\s+([\w.]+)/gm,
    ];
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) add(match[1]);
    }
    return { sources, language, parser: 'heuristic' };
  }

  try {
    const tree = parser.parse(content);
    walk(tree.rootNode, (node) => {
      if (node.type === 'import_statement') {
        if (language === 'python') {
          const match = node.text.match(/^import\s+([\w.]+)/);
          if (match) add(match[1]);
        } else {
          add(importSpecOf(node));
        }
      } else if (node.type === 'export_statement') {
        add(importSpecOf(node));
      } else if (node.type === 'import_from_statement') {
        const match = node.text.match(/^from\s+(\.*[\w.]+)\s+import\b/);
        if (match) add(match[1]);
      } else if (node.type === 'call_expression') {
        const fn = node.childForFieldName('function');
        if (fn && fn.type === 'identifier' && fn.text === 'require') {
          const args = node.childForFieldName('arguments');
          const first = args && args.namedChildren.find((child) => child.type === 'string');
          if (first) add(unquote(first.text));
        }
      } else if (node.type === 'using_directive') {
        const match = node.text.match(/^using\s+(?:static\s+)?([\w.]+)\s*;/);
        if (match) add(match[1]);
      } else if (node.type === 'import_spec') {
        const importPath = node.childForFieldName('path');
        if (importPath) add(unquote(importPath.text));
      }
    });
    return { sources, language, parser: 'tree-sitter' };
  } catch {
    return { sources, language, parser: 'heuristic' };
  }
}

const EXTRACTORS = {
  typescript: extractTypeScript,
  tsx: extractTypeScript,
  javascript: extractTypeScript,
  csharp: extractCSharp,
  python: extractPython,
  go: extractGo,
};

/**
 * Extract public symbols and relative import specifiers from a source file.
 * @param {string} filePath
 * @returns {{symbols: {classes: string[], interfaces: string[], types: string[], functions: string[]}, internalImports: string[], language: string, parser: 'tree-sitter'|'heuristic', sourceFile?: string}}
 */
export function extractSymbolsAndImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const language = detectLanguage(filePath);
  const grammar = grammarForFile(filePath);
  const parser = grammar ? getParser(grammar) : null;

  if (!parser || !grammar || !EXTRACTORS[grammar]) {
    return extractHeuristic(content, filePath, language);
  }

  try {
    const tree = parser.parse(content);
    const extracted = EXTRACTORS[grammar](tree.rootNode);
    return { ...extracted, language, parser: 'tree-sitter' };
  } catch {
    return extractHeuristic(content, filePath, language);
  }
}
