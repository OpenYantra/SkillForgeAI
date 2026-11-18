/**
 * Canonical in-process quality-gate runner.
 *
 * Consumed by `src/cli/commands/gate.mjs` and
 * `.agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs`, so
 * both entrypoints share identical gate selection, validation and reporting.
 *
 * The gate list is framework-owned. Adopter configuration may only map gates to
 * artifacts, and missing/unresolved required artifacts fail closed.
 */

import {
  GATE_REGISTRY,
  POLICY_HASH,
  POLICY_VERSION,
  isSelfTest,
  loadGateConfig,
  resolveGateTargets,
} from './gate-registry.mjs';

/**
 * Lazily import validators so commands that do not use them (diff, security,
 * graph, scaffold, ...) never load parser dependencies such as `yaml`.
 */
const VALIDATOR_LOADERS = {
  plan: async () => (await import('./validators/plan.mjs')).validatePlan,
  prd: async () => (await import('./validators/prd.mjs')).validatePrd,
  openapi: async () => (await import('./validators/openapi.mjs')).validateOpenApi,
  architecture: async () => (await import('./validators/architecture.mjs')).validateArchitecture,
  rca: async () => (await import('./validators/rca.mjs')).validateRca,
  ciContainer: async () => (await import('./validators/ci-container.mjs')).validateCiContainer,
  scaffold: async () => (await import('./validators/scaffold.mjs')).verifyScaffold,
  coverage: async () => (await import('./validators/coverage.mjs')).verifyCoverageCriteria,
  security: async () => (await import('./validators/security.mjs')).validateSecurity,
  signoff: async () => {
    const { verifySignOff } = await import('./signoff-verify.mjs');
    return (target, options) =>
      verifySignOff(target, {
        config: options.config,
        selfTest: options.selfTest,
        runGit: options.runGit,
        silent: true,
      });
  },
};

async function loadValidator(name) {
  const loader = VALIDATOR_LOADERS[name];
  if (!loader) return null;
  try {
    return await loader();
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    throw new Error(`Validator "${name}" could not be loaded (missing dependencies?). Run "npm ci". ${detail}`, {
      cause: err,
    });
  }
}

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
 * Reject configuration that attempts to change framework-owned policy.
 * @param {any} config
 * @returns {string[]}
 */
function runtimeConfigErrors(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['Gate config is missing or invalid.'];

  const gates = config.gates;
  const hasDisable = gates && Array.isArray(gates.disable) && gates.disable.length > 0;
  const hasValidators = gates && gates.validators && Object.keys(gates.validators).length > 0;
  if (hasDisable || hasValidators) {
    errors.push(
      'Gate overrides are not permitted: the gate policy is framework-owned (gate-policy.json). Remove "gates" from skillforge.config.json.',
    );
  }

  if (config.version != null && config.version !== 2) {
    errors.push('Config version must be 2. Version 1 configs are no longer supported.');
  }

  if (config.mode === undefined) {
    errors.push('Gate config must declare "mode" ("project" or "self-test").');
  } else if (!['project', 'self-test'].includes(config.mode)) {
    errors.push(`Invalid "mode": "${config.mode}".`);
  }

  return errors;
}

function failedSummary(config, selfTest, messages) {
  const results = messages.map((message, index) => ({
    id: `config-${index + 1}`,
    name: 'Gate Configuration',
    phase: 0,
    status: 'FAILED',
    reason: message,
    error: message,
  }));
  const summary = {
    timestamp: new Date().toISOString(),
    mode: selfTest ? 'self-test' : 'project',
    configSource: config.source || 'inline',
    policyVersion: config.policyVersion || POLICY_VERSION,
    policyHash: config.policyHash || POLICY_HASH,
    totalGates: 0,
    passed: 0,
    failed: 1,
    skipped: 0,
    skippedRequired: 0,
    status: 'FAILED',
    gates: results,
  };
  return { summary, results, activeGates: [] };
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

  if (config.source === 'default' && options.selfTest !== true) {
    return failedSummary(config, false, [
      'No skillforge.config.json found. Refusing to certify a project with framework self-test targets; pass --self-test to validate framework templates explicitly.',
    ]);
  }

  const selfTest = options.selfTest != null ? options.selfTest : isSelfTest(config, {});

  const configErrors = runtimeConfigErrors(config);
  if (configErrors.length > 0) {
    return failedSummary(config, selfTest, configErrors);
  }

  const registry = GATE_REGISTRY;
  const activeGates =
    options.phase != null ? registry.filter((gate) => gate.phase === Number(options.phase)) : registry;

  if (activeGates.length === 0) {
    throw new Error(`No quality gates found for phase: ${options.phase}`);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let skippedRequired = 0;
  const results = [];

  for (const gate of activeGates) {
    const resolved = resolveGateTargets(gate, config, { selfTest });
    const required = gate.required !== false;

    if (resolved.unresolved.length > 0 || resolved.rejected.length > 0) {
      const parts = [];
      if (resolved.unresolved.length > 0) {
        parts.push(`Unresolved required artifact pattern(s): ${resolved.unresolved.join(', ')}.`);
      }
      if (resolved.rejected.length > 0) {
        parts.push(
          `Artifact path(s) outside the allowed roots: ${resolved.rejected.join(', ')}. Add a trusted "allowedRoots" entry if this is intentional.`,
        );
      }
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'FAILED',
        reason: parts.join(' '),
        error: parts.join(' '),
        required,
        unresolved: resolved.unresolved,
        rejected: resolved.rejected,
      });
      failed++;
      continue;
    }

    if (resolved.missing) {
      if (options.allowMissing && required) {
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'SKIPPED',
          required: true,
          reason: `Required artifact "${gate.artifactKey}" is not configured; skipped with --allow-missing (run remains failed).`,
        });
        skipped++;
        skippedRequired++;
      } else if (options.allowMissing) {
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'SKIPPED',
          required: false,
          reason: `Optional artifact "${gate.artifactKey}" is not configured.`,
        });
        skipped++;
      } else {
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'FAILED',
          reason: `Required artifact "${gate.artifactKey}" is not configured or does not exist.`,
          required: true,
        });
        failed++;
      }
      continue;
    }

    let validator;
    try {
      validator = await loadValidator(gate.validator);
    } catch (err) {
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'FAILED',
        reason: err.message,
        error: err.message,
        targets: resolved.targets,
      });
      failed++;
      continue;
    }

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

  const status = failed === 0 && skippedRequired === 0 ? 'PASSED' : 'FAILED';
  const summary = {
    timestamp: new Date().toISOString(),
    mode: selfTest ? 'self-test' : 'project',
    configSource: config.source,
    policyVersion: config.policyVersion || POLICY_VERSION,
    policyHash: config.policyHash || POLICY_HASH,
    totalGates: activeGates.length,
    passed,
    failed,
    skipped,
    skippedRequired,
    status,
    gates: results,
  };

  return { summary, results, activeGates };
}
