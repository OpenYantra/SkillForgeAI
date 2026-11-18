/**
 * AUD-T: The Phase 5 test gate never executes tests.
 *
 * The framework claims tests must validate outcomes and cite requirement IDs
 * (AGENTS.md rule 3). The validator only counts syntax. Expected to FAIL.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyCoverageCriteria } from '../../src/core/validators/coverage.mjs';
import { makeTempDir, removeDir, writeFiles } from './helpers/audit.ts';

function withSuite<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const dir = makeTempDir('audit-coverage');
  try {
    writeFiles(dir, files);
    return fn(dir);
  } finally {
    removeDir(dir);
  }
}

describe('AUD-T: test gate integrity', () => {
  it('AUD-T01: a runtime-failing suite must fail the gate', () => {
    withSuite(
      {
        'broken.spec.ts':
          "import { it } from 'node:test';\nit('fails at runtime', () => {\n  assert.equal(1, 2);\n});\n",
      },
      (dir) => {
        const result: any = verifyCoverageCriteria(dir);
        assert.equal(result.passed, false, 'the gate counted assertions statically and never ran the failing suite');
      },
    );
  });

  it('AUD-T02: a skip-only suite must fail the gate', () => {
    withSuite(
      {
        'skipped.spec.ts':
          "import { it } from 'node:test';\nit.skip('disabled test', () => {\n  assert.equal(1, 2);\n});\n",
      },
      (dir) => {
        const result: any = verifyCoverageCriteria(dir);
        assert.equal(result.passed, false, 'an entirely skipped suite with no executed tests satisfied the gate');
      },
    );
  });

  it('AUD-T03: tests without requirement IDs must fail traceability', () => {
    withSuite(
      {
        'untraced.spec.ts':
          "import { it } from 'node:test';\nit('computes totals', () => {\n  assert.equal(1, 1);\n});\n",
      },
      (dir) => {
        const result: any = verifyCoverageCriteria(dir);
        assert.equal(
          result.passed,
          false,
          'AGENTS.md requires FR-/EC- citations, but a missing citation is only a warning',
        );
      },
    );
  });
});
