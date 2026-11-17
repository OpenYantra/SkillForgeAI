/**
 * Test Suite: version single-sourcing.
 * Covers improvement.md #16 (CLI, MCP server, package, and lockfile agree).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, runCli, runNode } from './helpers/workspace.ts';

function readJson(relativePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf-8'));
}

describe('version consistency', () => {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');

  it('keeps the lockfile in sync with package.json', () => {
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].version, pkg.version);
  });

  it('uses the package version in the CLI', () => {
    const result = runCli(['version']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), `SkillForgeAI v${pkg.version}`);
  });

  it('uses the package version in the MCP server', () => {
    const result = runNode(path.join(REPO_ROOT, 'scripts', 'mcp-server.mjs'), ['--test']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`skillforge-ai-mcp v${pkg.version.replace(/\./g, '\\.')}`));
  });
});
