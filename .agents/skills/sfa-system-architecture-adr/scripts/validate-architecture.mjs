#!/usr/bin/env node
/**
 * Skill wrapper: architecture specification & ADR validator.
 * Implementation: `src/core/validators/architecture.mjs`.
 */

import { validateArchitecture } from '../../../../src/core/validators/architecture.mjs';
import { runValidatorCli } from '../../../../src/cli/validator-output.mjs';

await runValidatorCli(validateArchitecture, {
  script: 'validate-architecture.mjs',
  usage: 'an architecture markdown file path',
  title: '🏛️  Architecture Specification Report',
  extraLines: (result) => [
    `Mermaid Diagrams Detected: ${result.details.mermaidBlocks || 0}`,
    `ADRs Indexed: ${(result.details.adrs || []).join(', ') || 'None'}`,
  ],
  successLines: () => [
    'Architecture document satisfies Phase 3 design standards!',
    'Ready for Contract Design & Scaffolding.',
  ],
  failureHint: 'Please fix the issues above before proceeding to Phase 4 (Scaffolding).',
});
