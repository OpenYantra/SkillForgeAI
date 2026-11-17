#!/usr/bin/env node
/**
 * Skill wrapper: PRD validator.
 * Implementation: `src/core/validators/prd.mjs`.
 */

import { validatePrd } from '../../../../src/core/validators/prd.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(validatePrd, {
  script: 'validate-prd.mjs',
  usage: 'a PRD markdown file path',
  title: '📋 PRD Validation Report',
  extraLines: (result) => [
    `Functional Requirements Identified: ${(result.details.functionalRequirements || []).join(', ') || 'None'}`,
  ],
  successLines: () => [
    'PRD meets all Wave 1 specification standards!',
    'Ready for Phase 4: `sfa-feature-scaffolder`.',
  ],
  failureHint: 'Please fix the issues above before moving to Phase 4 (Scaffolding).',
});
