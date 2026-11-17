/**
 * Test Suite: fence-aware Markdown structure parser.
 * Covers improvement.md #9 (section-aware validation instead of header regex).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripFencedCode,
  parseHeadings,
  hasHeading,
  sectionBody,
  countFencedBlocks,
  findIds,
  hasBddStatements,
} from '../src/core/markdown.mjs';

const DOC = `# Title

## 1. Scope Boundaries
Inline text.
### Out of Scope (Non-Goals)
Nothing yet.
### In Scope
Everything.

\`\`\`md
## 7. Acceptance Criteria
FR-999 inside a fence
\`\`\`

## 7. Acceptance Criteria (Given-When-Then)
- **Given** a thing
- **When** it runs
- **Then** it passes

\`\`\`mermaid
flowchart TD
\`\`\`

\`\`\`mermaid
flowchart LR
\`\`\`
`;

describe('markdown structure parser', () => {
  it('ignores headings and IDs inside fenced code', () => {
    const headings = parseHeadings(DOC);
    assert.ok(!headings.some((heading) => heading.text === 'Acceptance Criteria'));
    assert.ok(headings.some((heading) => heading.text.includes('Acceptance Criteria (Given-When-Then)')));
    assert.ok(!stripFencedCode(DOC).includes('FR-999'));
  });

  it('detects sections and includes child heading content', () => {
    assert.ok(hasHeading(DOC, /Scope Boundaries/i, 2));
    const scope = sectionBody(DOC, /Scope Boundaries/i) || '';
    assert.match(scope, /Out of Scope/);
    assert.match(scope, /Everything/);
    assert.equal(sectionBody(DOC, /Does Not Exist/i), null);
  });

  it('counts real mermaid fences only', () => {
    assert.equal(countFencedBlocks(DOC, 'mermaid'), 2);
    assert.equal(countFencedBlocks(DOC, 'json'), 0);
  });

  it('finds unique IDs and BDD statements', () => {
    assert.deepEqual(findIds('FR-001 FR-001 EC-002', /FR-\d{3}/g), ['FR-001']);
    assert.equal(hasBddStatements('**Given** x\n**When** y\n**Then** z'), true);
    assert.equal(hasBddStatements('Given only'), false);
  });
});
