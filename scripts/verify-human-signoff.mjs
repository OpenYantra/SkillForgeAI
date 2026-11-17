#!/usr/bin/env node
/**
 * Script wrapper: Human-in-the-Loop (HITL) sign-off verification.
 * The implementation lives in `src/core/signoff-verify.mjs`.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySignOff } from '../src/core/signoff-verify.mjs';

export { verifySignOff } from '../src/core/signoff-verify.mjs';

const isDirectCall = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectCall) {
  const result = verifySignOff(process.argv[2], { configPath: process.argv[3] });
  process.exit(result.passed ? 0 : 1);
}
