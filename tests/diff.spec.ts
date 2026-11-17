/**
 * Test Suite: Semantic diff command and breaking-change script.
 * Covers improvement.md #5 (safety net for `diff`).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  makeTempDir,
  removeDir,
  writeFiles,
  initGitRepo,
  commitAll,
  runCli,
  runNode,
  REPO_ROOT,
} from './helpers/workspace.ts';

const PORT_FILE = 'src/domain/ports/order.repository.ts';
const BASELINE_PORT = `export interface IOrderRepository {
  findById(id: string): Promise<string | null>;
  save(order: string): Promise<void>;
}
`;

function makeRepo(): string {
  const dir = makeTempDir('diff');
  initGitRepo(dir);
  writeFiles(dir, { [PORT_FILE]: BASELINE_PORT });
  commitAll(dir);
  return dir;
}

describe('diff command', () => {
  let dir: string;

  before(() => {
    dir = makeRepo();
  });

  after(() => {
    removeDir(dir);
  });

  it('reports PATCH for a clean working tree', () => {
    const result = runCli(['diff', '--json'], dir);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.highestSeverity, 'PATCH');
    assert.equal(report.totalChangedFiles, 0);
  });

  it('classifies removed port lines as DESTRUCTIVE / MAJOR', () => {
    writeFiles(dir, {
      [PORT_FILE]: `export interface IOrderRepository {
  save(order: string): Promise<void>;
}
`,
    });

    const result = runCli(['diff', '--json'], dir);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.highestSeverity, 'MAJOR');
    assert.ok(report.classifications.destructive.some((entry: { file: string }) => entry.file === PORT_FILE));
    assert.match(report.classifications.destructive[0].reason, /deleted\/modified line/);
  });

  it('classifies added port lines as ADDITIVE / MINOR', () => {
    const additiveDir = makeRepo();
    try {
      const updated = BASELINE_PORT.replace(
        'save(order: string): Promise<void>;',
        'save(order: string): Promise<void>;\n  delete(id: string): Promise<void>;',
      );
      writeFiles(additiveDir, { [PORT_FILE]: updated });

      const result = runCli(['diff', '--json'], additiveDir);
      const report = JSON.parse(result.stdout);
      assert.equal(report.highestSeverity, 'MINOR');
      assert.ok(report.classifications.additive.some((entry: { file: string }) => entry.file === PORT_FILE));
    } finally {
      removeDir(additiveDir);
    }
  });

  it('includes downstream callers from the cached code graph', () => {
    const graphDir = makeRepo();
    try {
      writeFiles(graphDir, {
        [PORT_FILE]: BASELINE_PORT.replace('save(order: string)', 'save(order: object)'),
        'docs/context/code-graph.json': JSON.stringify({
          nodes: {
            [PORT_FILE]: { importedBy: ['src/services/order.service.ts'] },
          },
        }),
      });

      const result = runCli(['diff', '--json'], graphDir);
      const report = JSON.parse(result.stdout);
      assert.deepEqual(report.affectedCallers, ['src/services/order.service.ts']);
    } finally {
      removeDir(graphDir);
    }
  });
});

describe('detect-breaking-changes script', () => {
  it('prints a MAJOR recommendation for removed interface lines', () => {
    const dir = makeRepo();
    try {
      writeFiles(dir, { [PORT_FILE]: 'export interface IOrderRepository {\n}\n' });
      const result = runNode(path.join(REPO_ROOT, 'scripts', 'detect-breaking-changes.mjs'), [], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Recommended SemVer Bump: MAJOR/);
    } finally {
      removeDir(dir);
    }
  });
});
