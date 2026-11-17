#!/usr/bin/env node
/**
 * Skill wrapper: Incident RCA validator.
 * Implementation: `src/core/validators/rca.mjs`.
 */

import { validateRca } from '../../../../src/core/validators/rca.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(validateRca, {
  script: 'validate-rca.mjs',
  usage: 'an RCA report file',
  title: '🔍 Incident RCA Validation',
  extraLines: (result) => [`Action Items Recorded: ${(result.details.actionItems || []).length}`],
  successLines: () => ['Post-mortem satisfies Phase 7 RCA standards!', 'Ready for archival and action-item tracking.'],
  failureHint: 'Please complete the missing sections before closing this incident.',
});
