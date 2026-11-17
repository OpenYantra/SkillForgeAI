/**
 * Test Suite: Unified CLI dispatcher.
 * Covers improvement.md #5 (top-level CLI safety net).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from './helpers/workspace.ts';

describe('skillforge CLI', () => {
  it('prints help for help and no arguments', () => {
    const explicit = runCli(['help']);
    assert.equal(explicit.status, 0);
    assert.match(explicit.stdout, /SkillForgeAI Unified CLI/);
    assert.match(explicit.stdout, /gate/);
    assert.match(explicit.stdout, /security/);

    const implicit = runCli([]);
    assert.equal(implicit.status, 0);
    assert.match(implicit.stdout, /Usage:/);
  });

  it('prints a version', () => {
    const result = runCli(['version']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /SkillForgeAI v\d+\.\d+\.\d+/);
  });

  it('rejects unknown commands with exit code 2', () => {
    const result = runCli(['definitely-not-a-command']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown command/);
  });

  it('dispatches command help without executing the command', () => {
    const result = runCli(['security', '--help']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /skillforge security/);
    assert.match(result.stdout, /--path/);
  });
});
