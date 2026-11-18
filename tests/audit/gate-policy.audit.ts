/**
 * AUD-G: Gate policy is writable by the agent it governs.
 *
 * The project config that decides which gates run (and how) lives inside the
 * repository an AI agent can edit. Every test below asserts the secure
 * behaviour and is expected to FAIL against the current implementation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runGates } from '../../src/core/gate-runner.mjs';
import { GATE_REGISTRY, isSelfTest, loadGateConfig, resolveGateTargets } from '../../src/core/gate-registry.mjs';
import { makeTempDir, projectConfig, removeDir, writeFiles } from './helpers/audit.ts';

describe('AUD-G: gate policy bypasses', () => {
  it('AUD-G01: disabling a mandatory gate must not yield PASSED', async () => {
    const result = await runGates({
      selfTest: true,
      config: projectConfig({ gates: { disable: ['security'] } }),
    });

    assert.notEqual(
      result.summary.status,
      'PASSED',
      'the security gate was disabled via skillforge.config.json and the run still certified the project',
    );
  });

  it('AUD-G02: remapping the security gate to a weaker validator must be rejected', async () => {
    const result = await runGates({
      phase: 6,
      config: projectConfig({ gates: { validators: { security: 'scaffold' } } }),
    });

    assert.notEqual(
      result.summary.status,
      'PASSED',
      'a config remap replaced the security audit with the scaffold boundary check and still passed',
    );
  });

  it('AUD-G03: evaluating zero gates with --allow-missing must not yield PASSED', async () => {
    const result = await runGates({
      config: projectConfig({ artifacts: {} }),
      allowMissing: true,
    });

    assert.notEqual(
      result.summary.status,
      'PASSED',
      `${result.summary.totalGates} gates were skipped (none evaluated) yet the run reported PASSED`,
    );
  });

  it('AUD-G04: a config without "mode" must not silently downgrade to self-test', async () => {
    assert.equal(
      isSelfTest({ version: 2 } as any),
      false,
      'isSelfTest() treats a missing mode as self-test, validating framework templates instead of project artifacts',
    );

    const result = await runGates({ config: { version: 2, artifacts: {} } as any });
    assert.notEqual(result.summary.mode, 'self-test', 'missing "mode" must fail closed, not fall back to self-test');
  });

  it('AUD-G05: artifact paths outside the repository must be rejected', () => {
    const outside = makeTempDir('audit-outside');
    try {
      writeFiles(outside, { 'feature.ts': 'export class Outside {}\n' });
      const scaffoldGate = GATE_REGISTRY.find((gate) => gate.id === 'scaffold')!;

      const resolved = resolveGateTargets(
        scaffoldGate,
        { mode: 'project', artifacts: { src: outside } },
        { selfTest: false },
      );

      const rejected = (resolved as any).rejected === true || resolved.missing === true;
      assert.equal(rejected, true, `artifact path "${outside}" (outside the repo) was accepted for validation`);
    } finally {
      removeDir(outside);
    }
  });

  it('AUD-G06: an unresolved required glob must fail the gate', async () => {
    const result = await runGates({
      phase: 4,
      config: projectConfig({
        artifacts: { src: ['examples/order-service/src', 'tests/audit/fixtures/missing/**'] },
      }),
    });

    assert.equal(
      result.summary.status,
      'FAILED',
      'a configured glob that matched nothing was silently ignored while the gate passed',
    );
  });

  it('AUD-G07: the config must be schema-validated at runtime', () => {
    const dir = makeTempDir('audit-config');
    try {
      const badConfig = path.join(dir, 'skillforge.config.json');
      writeFiles(dir, {
        'skillforge.config.json': JSON.stringify({
          version: 2,
          mode: 'project',
          artifactz: {},
          gates: { validators: { security: 'scaffold' } },
        }),
      });

      assert.throws(
        () => loadGateConfig(badConfig),
        /schema|unknown|invalid|not allowed/i,
        'loadGateConfig() accepted unknown keys and an arbitrary validator remap',
      );
    } finally {
      removeDir(dir);
    }
  });
});
