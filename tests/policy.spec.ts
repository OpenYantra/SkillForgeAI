/**
 * Test Suite: framework-owned gate policy.
 * Covers P0.1: hash verification, schema validation, fail-closed loading and
 * optional detached signatures.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computePolicyHash, loadPolicy, validatePolicy } from '../src/core/policy.mjs';
import { makeTempDir, removeDir } from './helpers/workspace.ts';

function realPolicy(): any {
  return JSON.parse(fs.readFileSync(path.resolve('gate-policy.json'), 'utf-8'));
}

function writePolicy(dir: string, policy: any): string {
  const file = path.join(dir, 'gate-policy.json');
  fs.writeFileSync(file, JSON.stringify(policy, null, 2) + '\n');
  return file;
}

describe('gate policy loading', () => {
  it('loads the shipped policy with a valid hash', () => {
    const policy = loadPolicy();
    assert.equal(policy.policyVersion, 1);
    assert.equal(policy.gates.length, 10);
    assert.equal(policy.policyHash, computePolicyHash(policy));
    assert.ok(policy.gates.every((gate: any) => gate.required === true));
  });

  it('rejects a hash mismatch', () => {
    const dir = makeTempDir('policy-hash');
    try {
      const policy = realPolicy();
      policy.gates[0].name = 'Tampered gate name';
      const file = writePolicy(dir, policy);
      assert.throws(() => loadPolicy({ path: file }), /hash mismatch/i);
    } finally {
      removeDir(dir);
    }
  });

  it('rejects an invalid policy shape', () => {
    const dir = makeTempDir('policy-shape');
    try {
      const file = writePolicy(dir, { policyVersion: 1, policyHash: 'sha256:x', gates: [] });
      assert.throws(() => loadPolicy({ path: file }), /Invalid gate policy.*non-empty array/i);
    } finally {
      removeDir(dir);
    }
  });

  it('fails closed when the policy is missing', () => {
    assert.throws(
      () => loadPolicy({ path: path.join(os.tmpdir(), `missing-policy-${Date.now()}.json`) }),
      /Gate policy not found/i,
    );
  });
});

describe('gate policy validation', () => {
  it('reports duplicate ids and invalid phases', () => {
    const policy = realPolicy();
    policy.gates = [policy.gates[0], { ...policy.gates[0], phase: 99 }];
    const errors = validatePolicy(policy);
    assert.ok(errors.some((error: string) => /duplicate gate id/i.test(error)));
    assert.ok(errors.some((error: string) => /invalid phase/i.test(error)));
  });
});

describe('gate policy signatures', () => {
  it('accepts a valid detached Ed25519 signature when required', () => {
    const dir = makeTempDir('policy-sig');
    try {
      const policy = realPolicy();
      policy.policyHash = computePolicyHash(policy);
      const file = writePolicy(dir, policy);
      const raw = fs.readFileSync(file);

      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      const signature = crypto.sign(null, raw, privateKey);
      fs.writeFileSync(`${file}.sig`, signature.toString('base64'));
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
      fs.writeFileSync(`${file}.pub`, publicKeyPem);

      assert.doesNotThrow(() => loadPolicy({ path: file, requireSignature: true }));
    } finally {
      removeDir(dir);
    }
  });

  it('fails when a signature is required but missing', () => {
    const dir = makeTempDir('policy-nosig');
    try {
      const policy = realPolicy();
      policy.policyHash = computePolicyHash(policy);
      const file = writePolicy(dir, policy);
      assert.throws(() => loadPolicy({ path: file, requireSignature: true }), /signature is required/i);
    } finally {
      removeDir(dir);
    }
  });

  it('rejects a bad signature', () => {
    const dir = makeTempDir('policy-badsig');
    try {
      const policy = realPolicy();
      policy.policyHash = computePolicyHash(policy);
      const file = writePolicy(dir, policy);

      const { publicKey } = crypto.generateKeyPairSync('ed25519');
      fs.writeFileSync(`${file}.sig`, Buffer.from('not-a-signature').toString('base64'));
      fs.writeFileSync(`${file}.pub`, publicKey.export({ type: 'spki', format: 'pem' }).toString());

      assert.throws(
        () => loadPolicy({ path: file, requireSignature: true }),
        /signature verification failed|could not be verified/i,
      );
    } finally {
      removeDir(dir);
    }
  });
});
