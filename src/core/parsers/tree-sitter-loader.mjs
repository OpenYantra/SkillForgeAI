/**
 * Lazy tree-sitter loader.
 *
 * Native grammar packages are optional at runtime: if a prebuilt binding is
 * unavailable, `getParser` returns null and callers fall back to heuristics.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const GRAMMAR_MODULES = {
  typescript: { module: 'tree-sitter-typescript', exportName: 'typescript' },
  tsx: { module: 'tree-sitter-typescript', exportName: 'tsx' },
  javascript: { module: 'tree-sitter-javascript', exportName: null },
  csharp: { module: 'tree-sitter-c-sharp', exportName: null },
  python: { module: 'tree-sitter-python', exportName: null },
  go: { module: 'tree-sitter-go', exportName: null },
};

const parserCache = new Map();
const languageCache = new Map();
const failedGrammars = new Set();
let ParserCtor = null;
let runtimeUnavailable = false;

/**
 * Map a file path to the tree-sitter grammar that should parse it.
 * @param {string} filePath
 * @returns {keyof typeof GRAMMAR_MODULES | null}
 */
export function grammarForFile(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.tsx':
    case '.jsx':
      return 'tsx';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.cs':
      return 'csharp';
    case '.py':
      return 'python';
    case '.go':
      return 'go';
    default:
      return null;
  }
}

function loadLanguage(grammar) {
  if (languageCache.has(grammar)) return languageCache.get(grammar);
  const spec = GRAMMAR_MODULES[grammar];
  if (!spec) return null;
  const mod = require(spec.module);
  const language = spec.exportName ? mod[spec.exportName] : mod;
  languageCache.set(grammar, language);
  return language;
}

/**
 * Get (or create) a parser for a grammar. Returns null when tree-sitter or the
 * grammar binding cannot be loaded.
 * @param {string} grammar
 */
export function getParser(grammar) {
  if (runtimeUnavailable || failedGrammars.has(grammar)) return null;
  if (parserCache.has(grammar)) return parserCache.get(grammar);
  try {
    if (!ParserCtor) ParserCtor = require('tree-sitter');
  } catch {
    runtimeUnavailable = true;
    return null;
  }
  try {
    const language = loadLanguage(grammar);
    if (!language) return null;
    const parser = new ParserCtor();
    parser.setLanguage(language);
    parserCache.set(grammar, parser);
    return parser;
  } catch {
    failedGrammars.add(grammar);
    return null;
  }
}
