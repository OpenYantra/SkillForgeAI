/**
 * Heuristic (regex) symbol extractor.
 *
 * Used only when a tree-sitter grammar binding is unavailable. Never claim
 * AST-level accuracy for results produced by this module.
 */

export function emptySymbols() {
  return { classes: [], interfaces: [], types: [], functions: [] };
}

export function detectLanguage(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.cs':
      return 'csharp';
    case '.py':
      return 'python';
    case '.go':
      return 'go';
    case '.ts':
    case '.tsx':
    case '.js':
    case '.mjs':
    case '.jsx':
      return 'typescript';
    default:
      return 'unknown';
  }
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

export function unquote(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/^['"`]|['"`]$/g, '');
}

/**
 * @param {string} content
 * @param {string} filePath
 * @param {string} language
 * @returns {{symbols: {classes: string[], interfaces: string[], types: string[], functions: string[]}, internalImports: string[], language: string, parser: 'heuristic', sourceFile: string}}
 */
export function extractHeuristic(content, filePath, language) {
  const symbols = emptySymbols();
  const internalImports = [];

  if (language === 'typescript') {
    for (const m of content.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/g)) {
      pushUnique(symbols.classes, m[1]);
    }
    for (const m of content.matchAll(/(?:export\s+)?interface\s+([A-Za-z0-9_]+)/g)) {
      pushUnique(symbols.interfaces, m[1]);
    }
    for (const m of content.matchAll(/(?:export\s+)?type\s+([A-Za-z0-9_]+)/g)) {
      pushUnique(symbols.types, m[1]);
    }
    for (const m of content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) {
      pushUnique(symbols.functions, m[1]);
    }

    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    for (const match of content.matchAll(importRegex)) {
      const spec = match[1] || match[2];
      if (spec && spec.startsWith('.')) pushUnique(internalImports, spec);
    }
  } else if (language === 'csharp') {
    for (const m of content.matchAll(
      /(?:public|internal)\s+(?:abstract\s+|sealed\s+|static\s+)?(?:class|record|struct)\s+([A-Za-z0-9_]+)/g,
    )) {
      pushUnique(symbols.classes, m[1]);
    }
    for (const m of content.matchAll(/(?:public|internal)\s+interface\s+([A-Za-z0-9_]+)/g)) {
      pushUnique(symbols.interfaces, m[1]);
    }
  } else if (language === 'python') {
    for (const m of content.matchAll(/^class\s+([A-Za-z0-9_]+)/gm)) {
      pushUnique(symbols.classes, m[1]);
    }
    for (const m of content.matchAll(/^def\s+([A-Za-z0-9_]+)/gm)) {
      if (!m[1].startsWith('__')) pushUnique(symbols.functions, m[1]);
    }
    for (const m of content.matchAll(/^from\s+(\.+[\w.]*)\s+import\s+/gm)) {
      pushUnique(internalImports, m[1]);
    }
  } else if (language === 'go') {
    for (const m of content.matchAll(/type\s+([A-Za-z0-9_]+)\s+struct/g)) {
      pushUnique(symbols.classes, m[1]);
    }
    for (const m of content.matchAll(/type\s+([A-Za-z0-9_]+)\s+interface/g)) {
      pushUnique(symbols.interfaces, m[1]);
    }
    for (const m of content.matchAll(/func\s+(?:\([A-Za-z0-9_\s*]+\)\s+)?([A-Za-z0-9_]+)\s*\(/g)) {
      pushUnique(symbols.functions, m[1]);
    }
  }

  return { symbols, internalImports, language, parser: 'heuristic', sourceFile: filePath };
}
