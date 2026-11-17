#!/usr/bin/env node
/**
 * Skill wrapper: project plan & risk register validator.
 * Implementation: `src/core/validators/plan.mjs`.
 */

import { validatePlan } from '../../../../src/core/validators/plan.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(validatePlan, {
  script: 'validate-plan.mjs',
  usage: 'a project plan file path',
  title: '📅 Project Plan Validation',
  extraLines: (result) => [
    `Milestones Detected: ${(result.details.milestones || []).join(', ')}`,
    `Risks Cataloged: ${(result.details.risks || []).length}`,
  ],
  successLines: () => [
    'Project Plan satisfies Phase 1 planning standards!',
    'Ready for Phase 2: `sfa-prd-generator-validator`.',
  ],
  failureHint: 'Please address issues above before proceeding to Phase 2 (Requirements).',
});
