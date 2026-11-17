/**
 * Test Suite: in-process gate runner and config-driven registry overrides.
 * Covers improvement.md #7 (single gate runner shared by CLI and skill).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runGates } from '../src/core/gate-runner.mjs';
import { applyGateConfig, GATE_REGISTRY } from '../src/core/gate-registry.mjs';
import { makeTempDir, removeDir } from './helpers/workspace.ts';

function config(overrides: Record<string, unknown> = {}) {
  return { mode: 'project', artifacts: {}, governance: {}, gates: {}, source: 'file', ...overrides };
}

describe('gate runner', () => {
  it('passes the framework self-test suite', async () => {
    const { summary } = await runGates({ selfTest: true, phase: 1 });
    assert.equal(summary.status, 'PASSED');
    assert.equal(summary.mode, 'self-test');
    assert.equal(summary.totalGates, 1);
  });

  it('fails closed on missing project artifacts', async () => {
    const { summary } = await runGates({ config: config(), phase: 1 });
    assert.equal(summary.status, 'FAILED');
    assert.equal(summary.gates[0].status, 'FAILED');
    assert.match(summary.gates[0].reason, /Required artifact/);
  });

  it('skips missing artifacts when allowMissing is set', async () => {
    const { summary } = await runGates({ config: config(), phase: 1, allowMissing: true });
    assert.equal(summary.status, 'PASSED');
    assert.equal(summary.gates[0].status, 'SKIPPED');
  });

  it('fails when a configured validator key is unknown', async () => {
    const { summary } = await runGates({
      config: config({
        artifacts: { plan: '.agents/skills/sfa-project-planner-estimator/templates/project-plan-template.md' },
        gates: { validators: { plan: 'nope' } },
      }),
      phase: 1,
    });
    assert.equal(summary.status, 'FAILED');
    assert.match(summary.gates[0].reason, /No validator registered/);
  });

  it('honours strict mode warnings', async () => {
    const dir = makeTempDir('gate-runner-strict');
    try {
      fs.mkdirSync(path.join(dir, 'domain'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'domain', 'entity.ts'),
        'export class Entity { static create(): void { throw new Error("generic"); } }\n',
      );
      const artifacts = { src: dir };

      const normal = await runGates({ config: config({ artifacts }), phase: 4 });
      assert.equal(normal.summary.status, 'PASSED');
      assert.equal(normal.summary.gates[0].warnings, true);

      const strict = await runGates({ config: config({ artifacts }), phase: 4, strict: true });
      assert.equal(strict.summary.status, 'FAILED');
      assert.match(strict.summary.gates[0].reason, /Strict mode warning/);
    } finally {
      removeDir(dir);
    }
  });

  it('throws for a phase with no registered gates', async () => {
    await assert.rejects(() => runGates({ selfTest: true, phase: 99 }), /No quality gates found/);
  });
});

describe('applyGateConfig', () => {
  it('disables gates and remaps validators', () => {
    const filtered = applyGateConfig(GATE_REGISTRY, { gates: { disable: ['plan'], validators: { prd: 'custom' } } });
    assert.ok(!filtered.some((gate) => gate.id === 'plan'));
    assert.equal(filtered.find((gate) => gate.id === 'prd')?.validator, 'custom');
    assert.equal(filtered.length, GATE_REGISTRY.length - 1);
  });

  it('is a no-op without overrides', () => {
    assert.deepEqual(applyGateConfig(GATE_REGISTRY, {}), GATE_REGISTRY);
  });
});
