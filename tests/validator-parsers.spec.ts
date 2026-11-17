/**
 * Test Suite: parser-backed validator edge cases.
 * Covers improvement.md #9 (fence-aware markdown, Dockerfile/CI structure,
 * AST-based test assertions).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validatePrd } from '../src/core/validators/prd.mjs';
import { validatePlan } from '../src/core/validators/plan.mjs';
import { validateCiContainer, parseDockerfileInstructions } from '../src/core/validators/ci-container.mjs';
import { verifyCoverageCriteria } from '../src/core/validators/coverage.mjs';
import { verifyScaffold } from '../src/core/validators/scaffold.mjs';
import { makeTempDir, removeDir, writeFiles } from './helpers/workspace.ts';

const VALID_PRD = `# PRD

## 1. Executive Summary
Summary.

## 2. Scope Boundaries
### In Scope
All.
### Out of Scope (Non-Goals)
None.

## 3. Functional Requirements
| ID | Title |
| FR-001 | Create |

## 4. Non-Functional Requirements
NFR.

## 5. Data Flow
Flow.

## 6. Edge Cases
| EC-001 | empty |

## 7. Acceptance Criteria
- **Given** x
- **When** y
- **Then** z
`;

function file(dir: string, name: string, content: string): string {
  const target = path.join(dir, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

describe('markdown-backed validators', () => {
  it('accepts a structurally valid PRD', () => {
    const dir = makeTempDir('val-prd');
    try {
      const result = validatePrd(file(dir, 'ok.prd.md', VALID_PRD));
      assert.equal(result.passed, true, result.errors.join('\n'));
      assert.deepEqual(result.details.functionalRequirements, ['FR-001']);
    } finally {
      removeDir(dir);
    }
  });

  it('does not accept headings or IDs that only appear in fenced code', () => {
    const dir = makeTempDir('val-prd-fence');
    try {
      const fenced = `# PRD\n\n\`\`\`md\n${VALID_PRD}\n\`\`\`\n`;
      const result = validatePrd(file(dir, 'fenced.prd.md', fenced));
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((error) => /Missing mandatory section/.test(error)));
    } finally {
      removeDir(dir);
    }
  });

  it('scopes functional requirement IDs to the Functional Requirements section', () => {
    const dir = makeTempDir('val-plan');
    try {
      const plan = `## 1. Executive Vision & Objectives\nFR-001 only here.\n## 2. Milestone Roadmap & WBS\nM1\n## 3. Task Breakdown Structure\nT\n## 4. Risk Register & Mitigation Strategy\nRSK-001\n`;
      const result = validatePlan(file(dir, 'plan.md', plan));
      assert.equal(result.passed, true, result.errors.join('\n'));
    } finally {
      removeDir(dir);
    }
  });
});

describe('CI and container parsing', () => {
  it('joins Dockerfile line continuations', () => {
    const instructions = parseDockerfileInstructions(
      'FROM node:24 AS build\nRUN echo one \\\n  && echo two\nUSER app\n',
    );
    assert.deepEqual(instructions, ['FROM node:24 AS build', 'RUN echo one    && echo two', 'USER app']);
  });

  it('rejects root containers', () => {
    const dir = makeTempDir('val-docker-root');
    try {
      const dockerfile = file(dir, 'Dockerfile', 'FROM node:24\nUSER root\n');
      const result = validateCiContainer(dockerfile);
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((error) => /root/.test(error)));
    } finally {
      removeDir(dir);
    }
  });

  it('discovers Dockerfile and workflow files in a directory', () => {
    const dir = makeTempDir('val-ci-dir');
    try {
      writeFiles(dir, {
        Dockerfile: 'FROM node:24 AS build\nFROM node:24 AS run\nUSER app\nHEALTHCHECK CMD true\n',
        '.github/workflows/ci.yml':
          'on: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n',
      });
      const result = validateCiContainer(dir);
      assert.equal(result.passed, true, result.errors.join('\n'));
      assert.equal(result.details.dockerfiles, 1);
      assert.equal(result.details.workflows, 1);
    } finally {
      removeDir(dir);
    }
  });

  it('fails when a directory has no Dockerfile or workflow', () => {
    const dir = makeTempDir('val-ci-empty');
    try {
      fs.writeFileSync(path.join(dir, 'README.md'), '# hi\n');
      const result = validateCiContainer(dir);
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((error) => /No Dockerfile/.test(error)));
    } finally {
      removeDir(dir);
    }
  });
});

describe('AST-backed coverage criteria', () => {
  it('counts it()/expect() and requirement citations', () => {
    const dir = makeTempDir('val-cov');
    try {
      const spec = file(
        dir,
        'order.spec.ts',
        "it('creates an order (FR-001)', () => { expect(1).toBe(1); });\ntest('cancels (EC-001)', () => { expect(true).toBe(true); });\n",
      );
      const result = verifyCoverageCriteria(spec);
      assert.equal(result.passed, true, result.errors.join('\n'));
      assert.equal(result.details.tests, 2);
      assert.equal(result.details.assertions, 2);
      assert.equal(result.details.requirementsCited, 2);
    } finally {
      removeDir(dir);
    }
  });

  it('rejects tests without assertions', () => {
    const dir = makeTempDir('val-cov-bad');
    try {
      const spec = file(dir, 'empty.spec.ts', "it('does nothing (FR-001)', () => {});\n");
      const result = verifyCoverageCriteria(spec);
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((error) => /0 assertions/.test(error)));
    } finally {
      removeDir(dir);
    }
  });
});

describe('scaffold boundary detection', () => {
  it('rejects bare framework imports in the domain layer', () => {
    const dir = makeTempDir('val-scaffold');
    try {
      file(dir, 'domain/order.ts', "import express from 'express';\nexport class Order {}\n");
      file(dir, 'services/order.service.ts', "import express from 'express';\nexport class OrderService {}\n");
      const result = verifyScaffold(dir);
      assert.equal(result.passed, false);
      assert.equal(result.errors.length, 1);
      assert.match(result.errors[0], /express/);
    } finally {
      removeDir(dir);
    }
  });
});
