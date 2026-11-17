/**
 * Generated-context drift checker.
 *
 * Regenerates the code graph and slice maps into a temporary directory, then
 * compares them with the committed `docs/context` artifacts. Volatile fields
 * (timestamps and temporary paths) are normalized before comparison.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCodeGraph, writeGraphArtifacts } from '../core/code-graph.mjs';
import { generateSliceMaps } from './commands/slice.mjs';

const BASE_FILES = ['code-graph.json', 'REPO-MAP.md', 'slices/index.md', 'slices/slices.json'];

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function normalize(text, replacements = []) {
  let result = text;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return result
    .split(/\r?\n/)
    .filter((line) => !/^\s*"generatedAt":/.test(line) && !/^- \*\*(Last Updated|Generated At):\*\*/.test(line))
    .join('\n');
}

function firstDifference(committed, generated) {
  const expected = committed.split('\n');
  const actual = generated.split('\n');
  const length = Math.max(expected.length, actual.length);
  for (let i = 0; i < length; i++) {
    if (expected[i] !== actual[i]) {
      return {
        line: i + 1,
        expected: (expected[i] || '').slice(0, 160),
        actual: (actual[i] || '').slice(0, 160),
      };
    }
  }
  return {};
}

function listMapFiles(contextDir) {
  const slicesDir = path.join(contextDir, 'slices');
  if (!fs.existsSync(slicesDir)) return [];
  return fs
    .readdirSync(slicesDir)
    .filter((name) => name.endsWith('-map.md'))
    .map((name) => `slices/${name}`);
}

/**
 * @param {string} [targetDir]
 * @returns {{ok: boolean, checked: number, stale: Array<{file: string, reason: string, line?: number, expected?: string, actual?: string}>, contextDir: string}}
 */
export function checkContextArtifacts(targetDir = '.') {
  const projectRoot = path.resolve(targetDir);
  const contextDir = path.join(projectRoot, 'docs', 'context');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfa-context-check-'));
  const previous = process.cwd();

  try {
    process.chdir(projectRoot);
    const { graph } = buildCodeGraph('.');
    writeGraphArtifacts(graph, temp);
    generateSliceMaps(graph, '.', temp);

    const files = [...new Set([...BASE_FILES, ...listMapFiles(contextDir), ...listMapFiles(temp)])].sort();
    const replacements = [
      [toPosix(temp), 'docs/context'],
      [toPosix(projectRoot), '.'],
    ];
    const stale = [];

    for (const relative of files) {
      const committedPath = path.join(contextDir, relative);
      const generatedPath = path.join(temp, relative);

      if (!fs.existsSync(committedPath)) {
        stale.push({ file: `docs/context/${relative}`, reason: 'missing from the repository' });
        continue;
      }
      if (!fs.existsSync(generatedPath)) {
        stale.push({ file: `docs/context/${relative}`, reason: 'no longer produced by graph/slice' });
        continue;
      }

      const committed = normalize(fs.readFileSync(committedPath, 'utf-8'), replacements);
      const generated = normalize(fs.readFileSync(generatedPath, 'utf-8'), replacements);
      if (committed !== generated) {
        stale.push({
          file: `docs/context/${relative}`,
          reason: 'content differs',
          ...firstDifference(committed, generated),
        });
      }
    }

    return { ok: stale.length === 0, checked: files.length, stale, contextDir };
  } finally {
    process.chdir(previous);
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
