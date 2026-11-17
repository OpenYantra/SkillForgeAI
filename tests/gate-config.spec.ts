/**
 * Test Suite: Project-aware Quality Gates
 * Validates config loading, target resolution (self-test vs project), glob
 * expansion, and fail-closed CLI behaviour for missing artifacts.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GATE_REGISTRY,
  loadGateConfig,
  isSelfTest,
  resolveGateTargets,
} from '../src/core/gate-registry.mjs';
import { expandGlob } from '../src/core/glob.mjs';

const BIN = path.resolve('bin/skillforge.mjs');

function writeTempConfig(obj: unknown): string {
  const file = path.join(os.tmpdir(), `sfa-gatecfg-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

function runGate(extraArgs: string[]) {
  return spawnSync(process.execPath, [BIN, 'gate', ...extraArgs], { encoding: 'utf-8' });
}

describe('gate config loading', () => {
  it('loads the repository self-test config by default', () => {
    const config = loadGateConfig();
    assert.equal(config.source, 'file');
    assert.equal(config.mode, 'self-test');
  });

  it('throws for an explicitly missing config path', () => {
    assert.throws(() => loadGateConfig('definitely-not-a-config.json'), /not found/i);
  });

  it('loads a project config and rejects invalid modes', () => {
    const projectConfig = writeTempConfig({ version: 1, mode: 'project', artifacts: { src: 'examples/order-service/src' } });
    const invalidConfig = writeTempConfig({ version: 1, mode: 'bogus' });
    try {
      const loaded = loadGateConfig(projectConfig);
      assert.equal(loaded.mode, 'project');
      assert.equal(loaded.source, 'file');
      assert.throws(() => loadGateConfig(invalidConfig), /Invalid "mode"/i);
    } finally {
      fs.unlinkSync(projectConfig);
      fs.unlinkSync(invalidConfig);
    }
  });
});

describe('isSelfTest', () => {
  it('defaults to self-test unless the config is project mode or the flag is set', () => {
    assert.equal(isSelfTest({ mode: 'self-test' }), true);
    assert.equal(isSelfTest({ mode: 'project' }), false);
    assert.equal(isSelfTest({ mode: 'project' }, { selfTest: true }), true);
  });
});

describe('resolveGateTargets', () => {
  const planGate = GATE_REGISTRY.find((g) => g.id === 'plan')!;
  const scaffoldGate = GATE_REGISTRY.find((g) => g.id === 'scaffold')!;

  it('uses the framework self-test target in self-test mode', () => {
    const resolved = resolveGateTargets(planGate, { mode: 'self-test', artifacts: {} }, { selfTest: true });
    assert.equal(resolved.missing, false);
    assert.deepEqual(resolved.targets, [planGate.selfTestTarget]);
  });

  it('fails closed when a project artifact is not configured', () => {
    const resolved = resolveGateTargets(planGate, { mode: 'project', artifacts: {} }, { selfTest: false });
    assert.equal(resolved.missing, true);
    assert.equal(resolved.targets.length, 0);
  });

  it('resolves an existing configured project artifact', () => {
    const resolved = resolveGateTargets(
      scaffoldGate,
      { mode: 'project', artifacts: { src: 'examples/order-service/src' } },
      { selfTest: false },
    );
    assert.equal(resolved.missing, false);
    assert.ok(resolved.targets.includes('examples/order-service/src'));
  });

  it('treats a non-existent explicit artifact as missing', () => {
    const resolved = resolveGateTargets(
      scaffoldGate,
      { mode: 'project', artifacts: { src: 'does/not/exist' } },
      { selfTest: false },
    );
    assert.equal(resolved.missing, true);
    assert.ok(resolved.unresolved.includes('does/not/exist'));
  });
});

describe('expandGlob', () => {
  let dir: string;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfa-glob-'));
    fs.mkdirSync(path.join(dir, 'a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a', 'one.prd.md'), 'x');
    fs.writeFileSync(path.join(dir, 'a', 'two.prd.md'), 'x');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'x');
  });

  after(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns explicit (non-glob) paths unchanged', () => {
    assert.deepEqual(expandGlob('docs/plan.md'), ['docs/plan.md']);
  });

  it('expands ** recursively and * within a segment', () => {
    assert.deepEqual(expandGlob('**/*.prd.md', dir), ['a/one.prd.md', 'a/two.prd.md']);
    assert.deepEqual(expandGlob('a/*.prd.md', dir), ['a/one.prd.md', 'a/two.prd.md']);
  });
});

describe('gate CLI project mode (fail closed)', () => {
  it('fails when a required artifact is missing', () => {
    const cfg = writeTempConfig({ version: 1, mode: 'project', artifacts: {} });
    try {
      const result = runGate(['--phase', '1', '--config', cfg, '--json']);
      assert.equal(result.status, 1);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, 'FAILED');
      assert.equal(report.mode, 'project');
      assert.equal(report.gates[0].status, 'FAILED');
    } finally {
      fs.unlinkSync(cfg);
    }
  });

  it('treats missing artifacts as SKIPPED with --allow-missing', () => {
    const cfg = writeTempConfig({ version: 1, mode: 'project', artifacts: {} });
    try {
      const result = runGate(['--phase', '1', '--config', cfg, '--json', '--allow-missing']);
      assert.equal(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, 'PASSED');
      assert.equal(report.skipped, 1);
      assert.equal(report.gates[0].status, 'SKIPPED');
    } finally {
      fs.unlinkSync(cfg);
    }
  });

  it('passes in forced self-test mode', () => {
    const result = runGate(['--phase', '1', '--self-test', '--json']);
    assert.equal(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, 'self-test');
    assert.equal(report.status, 'PASSED');
  });
});
