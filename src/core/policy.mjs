/**
 * Framework-owned gate policy manifest.
 *
 * The manifest lives outside `skillforge.config.json` so an adopter (or an AI
 * agent with repository write access) cannot disable gates or remap validators
 * from project configuration. Loading fails closed when the manifest is
 * missing, malformed, hash-mismatched, or (when required) unsigned.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const POLICY_FILE = 'gate-policy.json';
export const POLICY_VERSION = 1;

export function policyPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', POLICY_FILE);
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computePolicyHash(policy) {
  const payload = { policyVersion: policy.policyVersion, gates: policy.gates };
  const digest = crypto.createHash('sha256').update(canonicalize(payload)).digest('hex');
  return `sha256:${digest}`;
}

export function validatePolicy(policy) {
  const errors = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return ['policy root must be an object.'];
  }
  if (policy.policyVersion !== POLICY_VERSION) {
    errors.push(`policyVersion must be ${POLICY_VERSION}.`);
  }
  if (!Array.isArray(policy.gates) || policy.gates.length === 0) {
    errors.push('gates must be a non-empty array.');
    return errors;
  }

  const ids = new Set();
  for (const gate of policy.gates) {
    if (!gate || typeof gate !== 'object') {
      errors.push('every gate must be an object.');
      continue;
    }
    if (typeof gate.id !== 'string' || gate.id.length === 0) errors.push('gate.id must be a non-empty string.');
    if (ids.has(gate.id)) errors.push(`duplicate gate id "${gate.id}".`);
    ids.add(gate.id);
    if (!Number.isInteger(gate.phase) || gate.phase < 1 || gate.phase > 7) {
      errors.push(`gate "${gate.id}" has an invalid phase.`);
    }
    if (typeof gate.name !== 'string' || gate.name.length === 0) errors.push(`gate "${gate.id}" needs a name.`);
    if (typeof gate.artifactKey !== 'string' || gate.artifactKey.length === 0) {
      errors.push(`gate "${gate.id}" needs an artifactKey.`);
    }
    if (typeof gate.selfTestTarget !== 'string' || gate.selfTestTarget.length === 0) {
      errors.push(`gate "${gate.id}" needs a selfTestTarget.`);
    }
    if (typeof gate.validator !== 'string' || gate.validator.length === 0) {
      errors.push(`gate "${gate.id}" needs a validator.`);
    }
    if (gate.required !== true && gate.required !== false) {
      errors.push(`gate "${gate.id}" must declare required as a boolean.`);
    }
  }
  return errors;
}

function verifyPolicySignature(raw, file, options) {
  const requireSignature = options.requireSignature ?? process.env.SKILLFORGE_REQUIRE_POLICY_SIGNATURE === '1';
  const signaturePath = options.signaturePath || `${file}.sig`;
  const publicKey = options.publicKey || process.env.SKILLFORGE_POLICY_PUBKEY || readIfExists(`${file}.pub`);

  if (!requireSignature && (!fs.existsSync(signaturePath) || !publicKey)) return;
  if (!fs.existsSync(signaturePath) || !publicKey) {
    throw new Error(
      'Gate policy signature is required but missing. Provide gate-policy.json.sig and a public key via SKILLFORGE_POLICY_PUBKEY or gate-policy.json.pub.',
    );
  }

  let valid;
  try {
    const signature = Buffer.from(fs.readFileSync(signaturePath, 'utf-8').trim(), 'base64');
    valid = crypto.verify(null, Buffer.from(raw), publicKey, signature);
  } catch (err) {
    throw new Error(`Gate policy signature could not be verified: ${err.message}`, { cause: err });
  }
  if (!valid) throw new Error('Gate policy signature verification failed.');
}

/**
 * Load and verify the framework-owned gate policy.
 * @param {{path?: string, signaturePath?: string, publicKey?: string, requireSignature?: boolean}} [options]
 */
export function loadPolicy(options = {}) {
  const file = options.path || process.env.SKILLFORGE_POLICY_PATH || policyPath();
  if (!fs.existsSync(file)) {
    throw new Error(`Gate policy not found at "${file}". SkillForgeAI requires a framework-owned gate-policy.json.`);
  }

  const raw = fs.readFileSync(file, 'utf-8');
  let policy;
  try {
    policy = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in gate policy "${file}": ${err.message}`, { cause: err });
  }

  const errors = validatePolicy(policy);
  if (errors.length > 0) {
    throw new Error(`Invalid gate policy "${file}": ${errors.join(' ')}`);
  }

  const expectedHash = computePolicyHash(policy);
  if (policy.policyHash !== expectedHash) {
    throw new Error(
      `Gate policy hash mismatch in "${file}": manifest declares ${policy.policyHash || 'none'}, computed ${expectedHash}.`,
    );
  }

  verifyPolicySignature(raw, file, options);
  return policy;
}
