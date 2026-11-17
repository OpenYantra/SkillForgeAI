/**
 * Test Suite: Editor configuration synchronization.
 * Covers improvement.md #5 (safety net for `sync`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeDir, writeFiles, runNode, REPO_ROOT } from './helpers/workspace.ts';

describe('sync-editors script', () => {
  it('generates every editor configuration with the installed skill list', () => {
    const dir = makeTempDir('sync');
    try {
      writeFiles(dir, {
        '.agents/skills/sfa-demo/SKILL.md': `---\nname: sfa-demo\ndescription: Demo SDLC skill\n---\n\n# Demo\n`,
      });

      const result = runNode(path.join(REPO_ROOT, 'scripts', 'sync-editors.mjs'), [], dir);
      assert.equal(result.status, 0, result.stderr);

      const expected = [
        'AGENTS.md',
        '.cursorrules',
        'CLAUDE.md',
        '.windsurfrules',
        'OPENCODE.md',
        '.opencode/instructions.md',
        '.github/copilot-instructions.md',
        '.vscode/tasks.json',
        '.clinerules',
      ];
      for (const file of expected) {
        assert.ok(fs.existsSync(path.join(dir, file)), `expected ${file}`);
      }

      const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      assert.match(agents, /sfa-demo/);
      assert.match(agents, /Demo SDLC skill/);

      const tasks = JSON.parse(fs.readFileSync(path.join(dir, '.vscode', 'tasks.json'), 'utf-8'));
      assert.ok(Array.isArray(tasks.tasks));
      assert.ok(tasks.tasks.some((task: { label: string }) => task.label.includes('Quality Gates')));
    } finally {
      removeDir(dir);
    }
  });

  it('keeps folded skill descriptions intact', () => {
    const dir = makeTempDir('sync-folded');
    try {
      writeFiles(dir, {
        '.agents/skills/sfa-demo/SKILL.md': `---
name: sfa-demo
description: >-
  First sentence of the skill description.
  Second sentence that used to be truncated.
---

# Demo
`,
      });

      const result = runNode(path.join(REPO_ROOT, 'scripts', 'sync-editors.mjs'), [], dir);
      assert.equal(result.status, 0, result.stderr);

      const agents = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
      assert.match(agents, /First sentence of the skill description/);
      assert.match(agents, /Second sentence that used to be truncated/);
      assert.doesNotMatch(agents, /First sentence of the skill description\.$/m);
    } finally {
      removeDir(dir);
    }
  });

  it('detects stale editor configs with --check', () => {
    const dir = makeTempDir('sync-check');
    try {
      writeFiles(dir, {
        '.agents/skills/sfa-demo/SKILL.md': '---\nname: sfa-demo\ndescription: Demo skill\n---\n',
      });

      assert.equal(runNode(path.join(REPO_ROOT, 'scripts', 'sync-editors.mjs'), [], dir).status, 0);

      const fresh = runNode(path.join(REPO_ROOT, 'scripts', 'sync-editors.mjs'), ['--check'], dir);
      assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
      assert.match(fresh.stdout, /up to date/);

      fs.appendFileSync(path.join(dir, 'AGENTS.md'), '\nmanual edit\n');
      const stale = runNode(path.join(REPO_ROOT, 'scripts', 'sync-editors.mjs'), ['--check'], dir);
      assert.equal(stale.status, 1);
      assert.match(stale.stderr, /stale/);
      assert.match(stale.stderr, /AGENTS\.md/);
    } finally {
      removeDir(dir);
    }
  });
});
