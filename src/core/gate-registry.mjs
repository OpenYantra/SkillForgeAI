/**
 * Canonical SDLC gate registry and project configuration resolver.
 *
 * The gate list (which gates exist, their phase, validator and whether they are
 * required) is framework-owned and loaded from `gate-policy.json`. Adopter
 * configuration can only map gates to artifacts; it cannot disable gates or
 * remap validators.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expandGlob, hasGlob } from './glob.mjs';
import { computePolicyHash, loadPolicy } from './policy.mjs';

export const DEFAULT_CONFIG_FILE = 'skillforge.config.json';
export const CONFIG_VERSION = 2;
export const VALID_MODES = ['project', 'self-test'];

const TOP_LEVEL_KEYS = new Set(['$schema', 'version', 'mode', 'artifacts', 'governance', 'allowedRoots']);
const ARTIFACT_KEYS = new Set([
  'plan',
  'prd',
  'openapi',
  'architecture',
  'signoff',
  'src',
  'tests',
  'dockerfile',
  'rca',
]);
const GOVERNANCE_KEYS = new Set([
  'allowedReviewers',
  'allowedKeys',
  'requireSignedCommits',
  'signoffTtlDays',
  'allowAgentIdentities',
]);

export const GATE_POLICY = loadPolicy();
export const POLICY_VERSION = GATE_POLICY.policyVersion;
export const POLICY_HASH = computePolicyHash(GATE_POLICY);

/**
 * @typedef {{id: string, phase: number, name: string, script: string, artifactKey: string, selfTestTarget: string, required: boolean, validator: string}} Gate
 */

export const GATE_REGISTRY = /** @type {Gate[]} */ (GATE_POLICY.gates.map((gate) => ({ ...gate })));

/**
 * Validate adopter configuration. Gate overrides are not part of the schema:
 * policy is framework-owned.
 * @param {any} raw
 * @returns {string[]}
 */
export function validateConfig(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['config root must be an object.'];
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      if (key === 'gates') {
        errors.push(
          'unknown key "gates": gate overrides are not permitted because the gate policy is framework-owned (gate-policy.json). Remove "gates" from skillforge.config.json.',
        );
      } else {
        errors.push(`unknown key "${key}".`);
      }
    }
  }

  if (raw.version !== CONFIG_VERSION) {
    errors.push(
      `version must be ${CONFIG_VERSION}.` +
        (raw.version === 1 ? ' Version 1 configs are no longer supported: remove "gates" and set "version": 2.' : ''),
    );
  }

  if (raw.mode === undefined) {
    errors.push('Missing required key "mode" ("project" or "self-test").');
  } else if (!VALID_MODES.includes(raw.mode)) {
    errors.push(`Invalid "mode": "${raw.mode}" (expected one of: ${VALID_MODES.join(', ')}).`);
  }

  if (raw.artifacts !== undefined) {
    if (!raw.artifacts || typeof raw.artifacts !== 'object' || Array.isArray(raw.artifacts)) {
      errors.push('"artifacts" must be an object mapping artifact keys to a path, glob, or array of paths.');
    } else {
      for (const [key, value] of Object.entries(raw.artifacts)) {
        if (!ARTIFACT_KEYS.has(key)) errors.push(`unknown artifact key "${key}".`);
        const validValue =
          typeof value === 'string' ||
          (Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string'));
        if (!validValue) errors.push(`artifact "${key}" must be a string or a non-empty array of strings.`);
      }
    }
  }

  if (raw.allowedRoots !== undefined) {
    if (!Array.isArray(raw.allowedRoots) || !raw.allowedRoots.every((entry) => typeof entry === 'string')) {
      errors.push('"allowedRoots" must be an array of directory paths.');
    }
  }

  if (raw.governance !== undefined) {
    if (!raw.governance || typeof raw.governance !== 'object' || Array.isArray(raw.governance)) {
      errors.push('"governance" must be an object.');
    } else {
      for (const [key, value] of Object.entries(raw.governance)) {
        if (!GOVERNANCE_KEYS.has(key)) errors.push(`unknown governance key "${key}".`);
        if (key === 'allowedReviewers' && !Array.isArray(value))
          errors.push('governance.allowedReviewers must be an array.');
        if (key === 'allowedKeys' && !Array.isArray(value)) errors.push('governance.allowedKeys must be an array.');
        if (key === 'requireSignedCommits' && typeof value !== 'boolean') {
          errors.push('governance.requireSignedCommits must be a boolean.');
        }
        if (key === 'allowAgentIdentities' && typeof value !== 'boolean') {
          errors.push('governance.allowAgentIdentities must be a boolean.');
        }
        if (key === 'signoffTtlDays' && (!Number.isInteger(value) || value < 1)) {
          errors.push('governance.signoffTtlDays must be a positive integer.');
        }
      }
    }
  }

  return errors;
}

/**
 * Load and validate the project gate configuration.
 * @param {string} [configPath] explicit config path (relative or absolute)
 * @returns {{version: number, mode: string, artifacts: object, governance: object, allowedRoots: string[], source: string, path: string, policyVersion: number, policyHash: string}}
 */
export function loadGateConfig(configPath) {
  const target = configPath || DEFAULT_CONFIG_FILE;
  const resolved = path.resolve(target);

  if (!fs.existsSync(resolved)) {
    if (configPath) throw new Error(`Config file not found: ${resolved}`);
    return {
      version: CONFIG_VERSION,
      mode: 'self-test',
      artifacts: {},
      governance: {},
      allowedRoots: [],
      source: 'default',
      path: resolved,
      policyVersion: POLICY_VERSION,
      policyHash: POLICY_HASH,
    };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${resolved}: ${err.message}`, { cause: err });
  }

  const errors = validateConfig(raw);
  if (errors.length > 0) {
    throw new Error(`Invalid config (${resolved}): ${errors.join(' ')}`);
  }

  return {
    version: raw.version,
    mode: raw.mode,
    artifacts: raw.artifacts || {},
    governance: raw.governance || {},
    allowedRoots: raw.allowedRoots || [],
    source: 'file',
    path: resolved,
    policyVersion: POLICY_VERSION,
    policyHash: POLICY_HASH,
  };
}

/**
 * Determine whether to run in self-test mode.
 * `--self-test` always wins; otherwise project mode is used only when the
 * config explicitly sets `"mode": "project"`. A config without a mode is
 * treated as project mode and rejected by the runner (fail closed).
 */
export function isSelfTest(config, flags = {}) {
  if (flags.selfTest) return true;
  return !config || config.mode === 'self-test';
}

/**
 * Retained for backwards compatibility. Gate overrides are no longer allowed.
 * @param {typeof GATE_REGISTRY} registry
 * @param {{gates?: {disable?: string[], validators?: Record<string, string>}}} [config]
 * @returns {typeof GATE_REGISTRY}
 */
export function applyGateConfig(registry, config) {
  const gates = config && config.gates;
  const hasDisable = gates && Array.isArray(gates.disable) && gates.disable.length > 0;
  const hasValidators = gates && gates.validators && Object.keys(gates.validators).length > 0;
  if (hasDisable || hasValidators) {
    throw new Error(
      'Gate overrides are not permitted: the gate policy is framework-owned (gate-policy.json). Remove "gates" from skillforge.config.json.',
    );
  }
  return registry;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveAllowedRoots(config) {
  const root = process.cwd();
  const extra = (config && Array.isArray(config.allowedRoots) ? config.allowedRoots : []).map((entry) =>
    path.resolve(root, entry),
  );
  return [root, ...extra];
}

/**
 * Resolve the concrete target path(s) for a gate.
 * @returns {{targets: string[], missing: boolean, unresolved: string[], rejected: string[], source: 'self-test'|'config'}}
 */
export function resolveGateTargets(gate, config, opts = {}) {
  if (opts.selfTest) {
    return { targets: [gate.selfTestTarget], missing: false, unresolved: [], rejected: [], source: 'self-test' };
  }

  const raw = config && config.artifacts ? config.artifacts[gate.artifactKey] : undefined;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (entries.length === 0) {
    return { targets: [], missing: true, unresolved: [], rejected: [], source: 'config' };
  }

  const root = process.cwd();
  const allowedRoots = resolveAllowedRoots(config);
  const candidates = [];
  const unresolved = [];
  const rejected = [];

  for (const entry of entries) {
    const absolute = path.resolve(root, entry);

    if (!allowedRoots.some((allowed) => isInside(allowed, absolute))) {
      rejected.push(entry);
      continue;
    }

    if (hasGlob(entry)) {
      if (path.isAbsolute(entry)) {
        unresolved.push(entry);
        continue;
      }
      const matches = expandGlob(entry, root);
      if (matches.length === 0) unresolved.push(entry);
      for (const match of matches) {
        if (!candidates.includes(match)) candidates.push(match);
      }
      continue;
    }

    if (!fs.existsSync(absolute)) {
      unresolved.push(entry);
    } else if (!candidates.includes(entry)) {
      candidates.push(entry);
    }
  }

  const targets = candidates.filter((candidate) => fs.existsSync(candidate));
  return { targets, missing: targets.length === 0, unresolved, rejected, source: 'config' };
}
