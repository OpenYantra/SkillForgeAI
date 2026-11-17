/**
 * Test Suite: Skill-side quality gate orchestrator.
 * Covers improvement.md #5 (orchestrator parity with `skillforge gate`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runNode, REPO_ROOT } from './helpers/workspace.ts';

const SCRIPT = path.join(
  REPO_ROOT,
  '.agents',
  'skills',
  'sfa-quality-gate-orchestrator',
  'scripts',
  'run-all-gates.mjs',
);

function tempConfig(): string {
  const file = path.join(os.tmpdir(), `sfa-orch-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify({ version: 1, mode: 'project', artifacts: {} }));
  return file;
}

describe('run-all-gates orchestrator', () => {
  it('passes the framework self-test suite', () => {
    const result = runNode(SCRIPT, ['--self-test']);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /ALL SDLC QUALITY GATES PASSED/);
  });

  it('fails closed when project artifacts are missing', () => {
    const config = tempConfig();
    try {
      const result = runNode(SCRIPT, ['--phase', '1', '--config', config]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /FAILED \(missing artifact\)/);
    } finally {
      fs.unlinkSync(config);
    }
  });

  it('treats missing artifacts as SKIPPED with --allow-missing', () => {
    const config = tempConfig();
    try {
      const result = runNode(SCRIPT, ['--phase', '1', '--config', config, '--allow-missing']);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /SKIPPED/);
    } finally {
      fs.unlinkSync(config);
    }
  });

  it('rejects phases without registered gates', () => {
    const result = runNode(SCRIPT, ['--phase', '99', '--self-test']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No quality gates found/);
  });
});
