/**
 * Validator registry used by the in-process gate runner and skill wrappers.
 */

import { validatePlan } from './plan.mjs';
import { validatePrd } from './prd.mjs';
import { validateOpenApi } from './openapi.mjs';
import { validateArchitecture } from './architecture.mjs';
import { validateRca } from './rca.mjs';
import { validateCiContainer } from './ci-container.mjs';
import { verifyScaffold } from './scaffold.mjs';
import { verifyCoverageCriteria } from './coverage.mjs';
import { validateSecurity } from './security.mjs';
import { verifySignOff } from '../signoff-verify.mjs';

export {
  validatePlan,
  validatePrd,
  validateOpenApi,
  validateArchitecture,
  validateRca,
  validateCiContainer,
  verifyScaffold,
  verifyCoverageCriteria,
  validateSecurity,
  verifySignOff,
};

export const VALIDATORS = {
  plan: (target) => validatePlan(target),
  prd: (target) => validatePrd(target),
  openapi: (target) => validateOpenApi(target),
  architecture: (target) => validateArchitecture(target),
  rca: (target) => validateRca(target),
  ciContainer: (target) => validateCiContainer(target),
  scaffold: (target) => verifyScaffold(target),
  coverage: (target) => verifyCoverageCriteria(target),
  security: (target, options) => validateSecurity(target, options),
  signoff: (target, options) =>
    verifySignOff(target, {
      config: options.config,
      selfTest: options.selfTest,
      runGit: options.runGit,
      silent: true,
    }),
};
