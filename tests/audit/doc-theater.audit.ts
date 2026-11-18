/**
 * AUD-D: Document gates are structural theatre.
 *
 * Headings plus identifier strings are enough to certify a PRD or architecture
 * document that contains no actual content. Expected to FAIL.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrd } from '../../src/core/validators/prd.mjs';
import { validateArchitecture } from '../../src/core/validators/architecture.mjs';
import { fixture } from './helpers/audit.ts';

describe('AUD-D: document gate semantics', () => {
  it('AUD-D01: a PRD with headings and IDs but no substance must fail', () => {
    const result: any = validatePrd(fixture('docs', 'theater-prd.md'));
    assert.equal(
      result.passed,
      false,
      'a PRD whose body is "None. / N/A / FR-001 / Given When Then." was certified as complete',
    );
  });

  it('AUD-D02: empty Mermaid fences must not satisfy the architecture diagram requirement', () => {
    const result: any = validateArchitecture(fixture('docs', 'empty-diagrams-architecture.md'));
    assert.equal(result.passed, false, 'two empty ```mermaid fences counted as two C4 diagrams');
  });

  it('AUD-D03: ADR absence is a Phase 3 warning (accepted policy)', () => {
    const result: any = validateArchitecture(fixture('docs', 'no-adr-architecture.md'));
    assert.equal(result.passed, true, 'ADR absence is allowed at Phase 3');
    assert.ok(
      result.warnings.some((warning: string) => /ADR/i.test(warning)),
      'missing ADR index should still be warned at Phase 3',
    );
  });
});
