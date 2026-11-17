/**
 * Canonical SDLC quality-gate registry and project configuration resolver.
 *
 * Single source of truth for the 10 gates used by:
 * - `src/cli/commands/gate.mjs` (the `skillforge gate` command)
 * - `.agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs`
 *
 * Validator `script`s are framework-owned; `target`s are project-owned and
 * resolved from `skillforge.config.json`. When no config (or self-test mode)
 * is active, each gate falls back to its framework `selfTestTarget`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expandGlob } from './glob.mjs';

export const DEFAULT_CONFIG_FILE = 'skillforge.config.json';

/**
 * @typedef {{id: string, phase: number, name: string, script: string, artifactKey: string, selfTestTarget: string, required: boolean, validator?: string}} Gate
 */

export const GATE_REGISTRY = /** @type {Gate[]} */ ([
  {
    id: 'plan',
    phase: 1,
    name: 'Phase 1: Planning & Feasibility',
    script: '.agents/skills/sfa-project-planner-estimator/scripts/validate-plan.mjs',
    artifactKey: 'plan',
    selfTestTarget: '.agents/skills/sfa-project-planner-estimator/templates/project-plan-template.md',
    required: true,
  },
  {
    id: 'prd',
    phase: 2,
    name: 'Phase 2: Requirements Analysis (PRD)',
    script: '.agents/skills/sfa-prd-generator-validator/scripts/validate-prd.mjs',
    artifactKey: 'prd',
    selfTestTarget: 'examples/order-service/order-service.prd.md',
    required: true,
  },
  {
    id: 'openapi',
    phase: 2,
    name: 'Phase 2/3: API Contract (OpenAPI)',
    script: '.agents/skills/sfa-api-contract-designer/scripts/validate-openapi.mjs',
    artifactKey: 'openapi',
    selfTestTarget: '.agents/skills/sfa-api-contract-designer/templates/openapi-template.yaml',
    required: true,
  },
  {
    id: 'architecture',
    phase: 3,
    name: 'Phase 3: Architecture & ADRs',
    script: '.agents/skills/sfa-system-architecture-adr/scripts/validate-architecture.mjs',
    artifactKey: 'architecture',
    selfTestTarget: '.agents/skills/sfa-system-architecture-adr/templates/architecture-spec-template.md',
    required: true,
  },
  {
    id: 'signoff',
    phase: 3,
    name: 'Phase 3 -> 4: Human-in-the-Loop (HITL) Sign-Off Gate',
    script: 'scripts/verify-human-signoff.mjs',
    artifactKey: 'signoff',
    selfTestTarget: 'examples/order-service/docs/approvals/order-service-signoff.md',
    required: true,
  },
  {
    id: 'scaffold',
    phase: 4,
    name: 'Phase 4: Code Scaffolding Boundaries',
    script: '.agents/skills/sfa-feature-scaffolder/scripts/verify-scaffold.mjs',
    artifactKey: 'src',
    selfTestTarget: 'examples/order-service/src',
    required: true,
  },
  {
    id: 'tests',
    phase: 5,
    name: 'Phase 5: Test Criteria & AAA Structure',
    script: '.agents/skills/sfa-unit-test-synthesizer/scripts/verify-coverage-criteria.mjs',
    artifactKey: 'tests',
    selfTestTarget: 'examples/order-service/tests/order.service.spec.ts',
    required: true,
  },
  {
    id: 'container',
    phase: 6,
    name: 'Phase 6: Container Hardening & CI/CD',
    script: '.agents/skills/sfa-cicd-container-automator/scripts/validate-ci-container.mjs',
    artifactKey: 'dockerfile',
    selfTestTarget: '.agents/skills/sfa-cicd-container-automator/templates/Dockerfile.template',
    required: true,
  },
  {
    id: 'security',
    phase: 6,
    name: 'Phase 6: Security Weakness & Vulnerability Audit',
    script: '.agents/skills/sfa-security-vulnerability-auditor/scripts/audit-security.mjs',
    artifactKey: 'src',
    selfTestTarget: 'examples/order-service/src',
    required: true,
  },
  {
    id: 'rca',
    phase: 7,
    name: 'Phase 7: Maintenance & Incident RCA',
    script: '.agents/skills/sfa-incident-root-cause-analyzer/scripts/validate-rca.mjs',
    artifactKey: 'rca',
    selfTestTarget: '.agents/skills/sfa-incident-root-cause-analyzer/templates/rca-report-template.md',
    required: true,
  },
]);

export const VALID_MODES = ['project', 'self-test'];

/** Maps each gate to the in-process validator implementation. */
const VALIDATOR_BY_ID = {
  plan: 'plan',
  prd: 'prd',
  openapi: 'openapi',
  architecture: 'architecture',
  signoff: 'signoff',
  scaffold: 'scaffold',
  tests: 'coverage',
  container: 'ciContainer',
  security: 'security',
  rca: 'rca',
};

for (const gate of GATE_REGISTRY) {
  gate.validator = VALIDATOR_BY_ID[gate.id];
}

/**
 * Load and validate the project gate configuration.
 * @param {string} [configPath] explicit config path (relative or absolute)
 * @returns {{mode: string, version: number, artifacts: object, governance: object, gates: object, source: string, path: string}}
 */
export function loadGateConfig(configPath) {
  const target = configPath || DEFAULT_CONFIG_FILE;
  const resolved = path.resolve(target);

  if (!fs.existsSync(resolved)) {
    if (configPath) throw new Error(`Config file not found: ${resolved}`);
    return {
      mode: 'self-test',
      version: 1,
      artifacts: {},
      governance: {},
      gates: {},
      source: 'default',
      path: resolved,
    };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${resolved}: ${err.message}`, { cause: err });
  }

  const mode = raw.mode || 'self-test';
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Invalid "mode": "${mode}" in ${resolved} (expected one of: ${VALID_MODES.join(', ')}).`);
  }

  return {
    mode,
    version: raw.version || 1,
    artifacts: raw.artifacts && typeof raw.artifacts === 'object' ? raw.artifacts : {},
    governance: raw.governance && typeof raw.governance === 'object' ? raw.governance : {},
    gates: raw.gates && typeof raw.gates === 'object' ? raw.gates : {},
    source: 'file',
    path: resolved,
  };
}

/**
 * Determine whether to run in self-test mode.
 * `--self-test` always wins; otherwise project mode is used only when the
 * config explicitly sets `"mode": "project"`.
 */
export function isSelfTest(config, flags = {}) {
  if (flags.selfTest) return true;
  return !config || config.mode !== 'project';
}

/**
 * Apply project-level gate overrides from `skillforge.config.json`.
 * @param {typeof GATE_REGISTRY} registry
 * @param {{gates?: {disable?: string[], validators?: Record<string, string>}}} [config]
 * @returns {typeof GATE_REGISTRY}
 */
export function applyGateConfig(registry, config) {
  const gates = (config && config.gates) || {};
  const disabled = Array.isArray(gates.disable) ? gates.disable : [];
  const overrides = gates.validators && typeof gates.validators === 'object' ? gates.validators : {};

  return registry
    .filter((gate) => !disabled.includes(gate.id))
    .map((gate) => (overrides[gate.id] ? { ...gate, validator: overrides[gate.id] } : gate));
}

/**
 * Resolve the concrete target path(s) for a gate.
 * @returns {{targets: string[], missing: boolean, unresolved: string[], source: 'self-test'|'config'}}
 */
export function resolveGateTargets(gate, config, opts = {}) {
  if (opts.selfTest) {
    return { targets: [gate.selfTestTarget], missing: false, unresolved: [], source: 'self-test' };
  }

  const raw = config && config.artifacts ? config.artifacts[gate.artifactKey] : undefined;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (entries.length === 0) {
    return { targets: [], missing: true, unresolved: [], source: 'config' };
  }

  const candidates = [];
  for (const entry of entries) {
    for (const t of expandGlob(entry)) {
      if (!candidates.includes(t)) candidates.push(t);
    }
  }

  const targets = candidates.filter((t) => fs.existsSync(t));
  const unresolved = candidates.filter((t) => !fs.existsSync(t));

  if (targets.length === 0) {
    return { targets, missing: true, unresolved, source: 'config' };
  }

  return { targets, missing: false, unresolved, source: 'config' };
}
