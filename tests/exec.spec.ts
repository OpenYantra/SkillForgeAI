/**
 * Test Suite: Safe child-process execution helper.
 * Covers improvement.md #5 (core execution utility).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runNode } from '../src/core/exec.mjs';
import { makeTempDir, removeDir } from './helpers/workspace.ts';

describe('runNode', () => {
  it('returns stdout and passes arguments without a shell', () => {
    const dir = makeTempDir('exec');
    try {
      const script = path.join(dir, 'echo.mjs');
      fs.writeFileSync(script, "process.stdout.write(process.argv.slice(2).join('|'));\n");
      assert.equal(runNode(script, ['a b', 'c"d']), 'a b|c"d');
    } finally {
      removeDir(dir);
    }
  });

  it('throws when the child process fails', () => {
    const dir = makeTempDir('exec-fail');
    try {
      const script = path.join(dir, 'fail.mjs');
      fs.writeFileSync(script, "process.stderr.write('boom'); process.exit(7);\n");
      assert.throws(
        () => runNode(script),
        (error: unknown) => {
          const execError = error as { status?: number; stderr?: string };
          return execError.status === 7 && String(execError.stderr).includes('boom');
        },
      );
    } finally {
      removeDir(dir);
    }
  });
});
