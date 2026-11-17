#!/usr/bin/env node
/**
 * Skill wrapper: Dockerfile & CI workflow validator.
 * Implementation: `src/core/validators/ci-container.mjs`.
 */

import { validateCiContainer } from '../../../../src/core/validators/ci-container.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(validateCiContainer, {
  script: 'validate-ci-container.mjs',
  usage: 'a Dockerfile or CI workflow path',
  title: '🚀 CI/CD & Container Verification',
  successLines: () => ['Configuration satisfies Phase 6 container and CI/CD standards!'],
  failureHint: 'Please fix the issues above before deploying.',
});
