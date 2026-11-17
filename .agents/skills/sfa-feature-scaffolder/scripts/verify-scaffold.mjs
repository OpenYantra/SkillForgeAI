#!/usr/bin/env node
/**
 * Skill wrapper: Clean Architecture scaffold verifier.
 * Implementation: `src/core/validators/scaffold.mjs`.
 */

import { verifyScaffold } from '../../../../src/core/validators/scaffold.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(verifyScaffold, {
  script: 'verify-scaffold.mjs',
  usage: 'a target feature directory',
  title: '🏗️  Polyglot Feature Scaffold Verification',
  extraLines: (result) => [`Scanned ${result.details.filesScanned || 0} source file(s).`],
  successLines: () => [
    'Feature structure conforms to clean architectural boundary standards.',
    'Ready for Phase 5: `sfa-unit-test-synthesizer`.',
  ],
  failureHint: 'Please fix the violations above before proceeding to Phase 5 (Unit Testing).',
});
