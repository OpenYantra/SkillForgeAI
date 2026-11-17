#!/usr/bin/env node
/**
 * Skill wrapper: OpenAPI contract validator.
 * Implementation: `src/core/validators/openapi.mjs`.
 */

import { validateOpenApi } from '../../../../src/core/validators/openapi.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(validateOpenApi, {
  script: 'validate-openapi.mjs',
  usage: 'an OpenAPI YAML or JSON file',
  title: '📡 OpenAPI Contract Report',
  extraLines: (result) => [
    `Specification Version: OpenAPI ${result.details.version || 'unknown'}`,
    `HTTP Operations Detected: ${(result.details.operations || []).length}`,
  ],
  successLines: () => [
    'API Contract meets all Contract-First design standards!',
    'Ready for frontend/backend integration.',
  ],
  failureHint: 'Please fix the issues above before scaffolding API endpoints.',
});
