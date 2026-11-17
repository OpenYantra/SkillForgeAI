/**
 * Canonical in-process quality-gate runner.
 *
 * Consumed by `src/cli/commands/gate.mjs` and
 * `.agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs`, so
 * both entrypoints share identical gate selection, validation and reporting.
 */

import { GATE_REGISTRY, loadGateConfig, isSelfTest, resolveGateTargets, applyGateConfig } from './gate-registry.mjs';
import { VALIDATORS } from './validators/index.mjs';

function normalizeValidatorResult(result) {
  if (!result || typeof result !== 'object') {
    return { errors: ['Validator returned no result.'], warnings: [], details: {} };
  }
  return {
    errors: Array.isArray(result.errors) ? result.errors : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    details: result.details || {},
  };
}

/**
 * @param {{
 *   phase?: number|null,
 *   configPath?: string,
 *   config?: object,
 *   selfTest?: boolean,
 *   allowMissing?: boolean,
 *   strict?: boolean,
 * }} [options]
 * @returns {Promise<{summary: any, results: object[], activeGates: object[]}>}
 */
export async function runGates(options = {}) {
  const config = options.config || loadGateConfig(options.configPath);
  const selfTest = options.selfTest != null ? options.selfTest : isSelfTest(config, {});

  const registry = applyGateConfig(GATE_REGISTRY, config);
  const activeGates =
    options.phase != null ? registry.filter((gate) => gate.phase === Number(options.phase)) : registry;

  if (activeGates.length === 0) {
    throw new Error(`No quality gates found for phase: ${options.phase}`);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const gate of activeGates) {
    const resolved = resolveGateTargets(gate, config, { selfTest });

    if (resolved.missing) {
      if (options.allowMissing) {
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'SKIPPED',
          reason: `No "${gate.artifactKey}" artifact configured in skillforge.config.json.`,
          unresolved: resolved.unresolved,
        });
        skipped++;
      } else {
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'FAILED',
          reason: `Required artifact "${gate.artifactKey}" is not configured or does not exist.`,
          unresolved: resolved.unresolved,
        });
        failed++;
      }
      continue;
    }

    const validator = VALIDATORS[gate.validator];
    if (typeof validator !== 'function') {
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'FAILED',
        reason: `No validator registered for "${gate.validator}".`,
        targets: resolved.targets,
      });
      failed++;
      continue;
    }

    const errors = [];
    const warnings = [];
    const details = [];

    for (const target of resolved.targets) {
      try {
        const result = normalizeValidatorResult(
          await validator(target, { config, selfTest, strict: Boolean(options.strict), gate }),
        );
        errors.push(...result.errors);
        warnings.push(...result.warnings);
        details.push({ target, ...result.details });
      } catch (err) {
        errors.push(err && err.message ? err.message : String(err));
      }
    }

    if (errors.length > 0) {
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'FAILED',
        error: errors[errors.length - 1],
        errors,
        warnings: warnings.length > 0,
        warningMessages: warnings,
        targets: resolved.targets,
        details,
      });
      failed++;
    } else if (options.strict && warnings.length > 0) {
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'FAILED',
        reason: 'Strict mode warning detected',
        errors: [],
        warnings: true,
        warningMessages: warnings,
        targets: resolved.targets,
        details,
      });
      failed++;
    } else {
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'PASSED',
        warnings: warnings.length > 0,
        warningMessages: warnings,
        targets: resolved.targets,
        details,
      });
      passed++;
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    mode: selfTest ? 'self-test' : 'project',
    configSource: config.source,
    totalGates: activeGates.length,
    passed,
    failed,
    skipped,
    status: failed === 0 ? 'PASSED' : 'FAILED',
    gates: results,
  };

  return { summary, results, activeGates };
}
