#!/usr/bin/env node
/**
 * Recompute the `policyHash` in `gate-policy.json`.
 *
 * Run this after an intentional policy change and commit the result. Runtime
 * loading fails closed when the declared hash does not match the gate payload.
 */

import fs from 'node:fs';
import path from 'node:path';
import { computePolicyHash } from '../src/core/policy.mjs';

const file = path.resolve('gate-policy.json');
const policy = JSON.parse(fs.readFileSync(file, 'utf-8'));
policy.policyHash = computePolicyHash(policy);
fs.writeFileSync(file, JSON.stringify(policy, null, 2) + '\n');
console.log(`Updated ${file}: ${policy.policyHash}`);
