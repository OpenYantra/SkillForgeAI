#!/usr/bin/env node
/**
 * Skill wrapper: test suite criteria verifier.
 * Implementation: `src/core/validators/coverage.mjs`.
 */

import { verifyCoverageCriteria } from '../../../../src/core/validators/coverage.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(verifyCoverageCriteria, {
  script: 'verify-coverage-criteria.mjs',
  usage: 'a test file or directory',
  title: '🧪 Polyglot Test Suite Verification Report',
  extraLines: (result) => [
    `Evaluated ${result.details.testFiles || 0} test file(s).`,
    `Total test cases detected: ${result.details.tests || 0}`,
    `Total assertions detected: ${result.details.assertions || 0}`,
    `Requirements / Edge cases cited: ${result.details.requirementsCited || 0}`,
  ],
  successLines: () => ['Test suite satisfies SDLC Phase 5 quality standards!', 'Testing phase verified successfully.'],
  failureHint: 'Please fix the issues above to complete the SDLC test gate.',
});
