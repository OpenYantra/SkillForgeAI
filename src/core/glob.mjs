/**
 * Minimal, dependency-free glob expansion.
 * Supports `*` (within a path segment), `?` (single character) and `**`
 * (any number of path segments). Patterns are matched against POSIX-style
 * paths relative to the provided root directory.
 */

import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'obj',
  '.vs',
  '.next',
  '.svelte-kit',
]);

export function hasGlob(pattern) {
  return /[*?]/.test(pattern);
}

function patternToRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*';
        i++;
        if (pattern[i + 1] === '/') i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

/**
 * Expand a glob pattern into a sorted list of matching paths (files and dirs).
 * Non-glob patterns are returned as-is (existence is left to the caller).
 * @param {string} pattern
 * @param {string} [root] directory the pattern is relative to (default: cwd)
 * @returns {string[]}
 */
export function expandGlob(pattern, root = '.') {
  const norm = String(pattern).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!hasGlob(norm)) return [norm];

  const regex = patternToRegExp(norm);
  const matches = [];
  const base = path.resolve(root);

  const walk = (absDir, relDir) => {
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (regex.test(rel)) matches.push(rel);
      if (entry.isDirectory()) walk(path.join(absDir, entry.name), rel);
    }
  };

  walk(base, '');
  return [...new Set(matches)].sort();
}
