/**
 * Exact module-resolution helpers for the code graph.
 *
 * Imports are resolved against the set of scanned files using deterministic
 * path candidates (extension + index resolution). No prefix/`startsWith`
 * matching is used, so `./foo` can never link to `foobar.ts`.
 */

import path from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.cs'];
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go'];

/**
 * Normalize a relative import specifier into a POSIX path relative to the file.
 * Handles JS/TS `./x`, `../x` and Python dotted relatives (`.x`, `..x`).
 * @param {string} fromFile POSIX-ish path of the importing file
 * @param {string} spec raw relative specifier
 * @returns {string} base path without extension
 */
export function resolveSpecToBase(fromFile, spec) {
  const clean = String(spec)
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/');
  if (!clean.startsWith('.')) return '';

  const dots = clean.match(/^\.+/)[0].length;
  const restRaw = clean.slice(dots);
  // JS/TS specifiers are path-like; Python dotted relatives need `.` -> `/`.
  const rest = restRaw.includes('/') ? restRaw : restRaw.replace(/\./g, '/');
  let baseDir = path.posix.dirname(fromFile.replace(/\\/g, '/'));
  for (let i = 1; i < dots; i++) baseDir = path.posix.dirname(baseDir);
  const base = rest ? path.posix.join(baseDir, rest) : baseDir;
  return base === '.' ? '' : base;
}

/**
 * Resolve a relative import to a scanned file.
 * @param {string} fromFile
 * @param {string} spec
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
export function resolveImport(fromFile, spec, fileSet) {
  const base = resolveSpecToBase(fromFile, spec);
  if (!base) return null;

  const candidates = [base];
  for (const ext of EXTENSIONS) candidates.push(`${base}${ext}`);
  candidates.push(`${base}.d.ts`);
  for (const ext of INDEX_EXTENSIONS) candidates.push(`${base}/index${ext}`);
  candidates.push(`${base}/__init__.py`);

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Link reverse dependencies and direct circular pairs in-place.
 * @param {Record<string, {imports: string[], importedBy: string[]}>} nodes
 * @param {Set<string>} fileSet
 * @returns {{unresolvedImports: string[], circularDependencies: string[]}}
 */
export function linkDependencies(nodes, fileSet) {
  const unresolvedImports = [];

  for (const [source, data] of Object.entries(nodes)) {
    const resolved = [];
    for (const spec of data.imports) {
      const target = resolveImport(source, spec, fileSet);
      if (target) {
        if (!resolved.includes(target)) resolved.push(target);
      } else if (!unresolvedImports.includes(spec)) {
        unresolvedImports.push(spec);
      }
    }
    data.imports = resolved;
  }

  for (const [source, data] of Object.entries(nodes)) {
    for (const target of data.imports) {
      if (!nodes[target]) continue;
      if (!nodes[target].importedBy.includes(source)) nodes[target].importedBy.push(source);
    }
  }

  const circularDependencies = [];
  for (const [source, data] of Object.entries(nodes)) {
    for (const target of data.imports) {
      if (!nodes[target] || !nodes[target].imports.includes(source)) continue;
      const pair = [source, target].sort().join(' <--> ');
      if (!circularDependencies.includes(pair)) circularDependencies.push(pair);
    }
  }

  return { unresolvedImports, circularDependencies };
}
