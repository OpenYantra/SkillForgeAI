/**
 * Test Suite: generated context artifact drift detection.
 * Covers improvement.md #17 (keep docs/context fresh in CI).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkContextArtifacts } from '../src/cli/context-check.mjs';
import { makeTempDir, removeDir, writeFiles, runCli } from './helpers/workspace.ts';

function generate(dir: string): void {
  const result = runCli(['graph'], dir);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

describe('checkContextArtifacts', () => {
  it('passes after generating docs/context', () => {
    const dir = makeTempDir('context-fresh');
    try {
      writeFiles(dir, { 'src/a.ts': 'export class A {}\n' });
      generate(dir);

      const result = checkContextArtifacts(dir);
      assert.equal(result.ok, true, JSON.stringify(result.stale, null, 2));
      assert.ok(result.checked >= 4);
    } finally {
      removeDir(dir);
    }
  });

  it('detects modified artifacts and missing files', () => {
    const dir = makeTempDir('context-stale');
    try {
      writeFiles(dir, { 'src/a.ts': 'export class A {}\n' });
      generate(dir);

      fs.appendFileSync(path.join(dir, 'docs', 'context', 'REPO-MAP.md'), '\nstale line\n');
      const modified = checkContextArtifacts(dir);
      assert.equal(modified.ok, false);
      assert.ok(modified.stale.some((entry) => entry.file.endsWith('REPO-MAP.md')));

      fs.rmSync(path.join(dir, 'docs', 'context', 'slices', 'index.md'));
      const missing = checkContextArtifacts(dir);
      assert.ok(missing.stale.some((entry) => entry.file.endsWith('slices/index.md') && /missing/.test(entry.reason)));
    } finally {
      removeDir(dir);
    }
  });

  it('fails when docs/context has never been generated', () => {
    const dir = makeTempDir('context-none');
    try {
      writeFiles(dir, { 'src/a.ts': 'export class A {}\n' });
      const result = checkContextArtifacts(dir);
      assert.equal(result.ok, false);
      assert.ok(result.stale.length > 0);
    } finally {
      removeDir(dir);
    }
  });
});

describe('graph --check', () => {
  it('exits 0 for fresh artifacts and 1 for stale artifacts', () => {
    const dir = makeTempDir('context-cli');
    try {
      writeFiles(dir, { 'src/a.ts': 'export class A {}\n' });
      generate(dir);

      const fresh = runCli(['graph', '--check'], dir);
      assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);

      fs.appendFileSync(path.join(dir, 'docs', 'context', 'code-graph.json'), '\n');
      const stale = runCli(['graph', '--check'], dir);
      assert.equal(stale.status, 1);
      assert.match(stale.stderr, /stale/);
    } finally {
      removeDir(dir);
    }
  });
});
