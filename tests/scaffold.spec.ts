/**
 * Test Suite: Clean Architecture scaffolding.
 * Covers improvement.md #5 (safety net for `scaffold`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeTempDir, removeDir, runCli, runNode } from './helpers/workspace.ts';

describe('scaffold command', () => {
  it('supports TypeScript dry-runs without writing files', () => {
    const dir = makeTempDir('scaffold-dry');
    try {
      const result = runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir, '--dry-run']);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Would create: .*billing\.entity\.ts/);
      assert.equal(fs.readdirSync(dir).length, 0);
    } finally {
      removeDir(dir);
    }
  });

  it('writes TypeScript Clean Architecture layers and a runnable test', () => {
    const dir = makeTempDir('scaffold-ts');
    try {
      const result = runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir]);
      assert.equal(result.status, 0, result.stderr);

      const expected = [
        'domain/entities/billing.entity.ts',
        'domain/ports/billing.repository.ts',
        'services/billing.service.ts',
        'repositories/in-memory-billing.repository.ts',
        'tests/billing.service.spec.ts',
      ];
      for (const file of expected) {
        assert.ok(fs.existsSync(path.join(dir, file)), `expected ${file}`);
      }

      const generatedTest = path.join(dir, 'tests', 'billing.service.spec.ts');
      const testRun = runNode('--experimental-strip-types', ['--test', generatedTest], dir);
      assert.equal(testRun.status, 0, testRun.stderr);
    } finally {
      removeDir(dir);
    }
  });

  it('supports .NET dry-runs', () => {
    const dir = makeTempDir('scaffold-dotnet');
    try {
      const result = runCli(['scaffold', '--name', 'billing', '--lang', 'dotnet', '--out', dir, '--dry-run']);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Domain[\\/]+Entities[\\/]+Billing\.cs/);
      assert.equal(fs.readdirSync(dir).length, 0);
    } finally {
      removeDir(dir);
    }
  });

  it('rejects unsupported languages and missing names', () => {
    const rejected = runCli(['scaffold', '--name', 'billing', '--lang', 'py', '--dry-run']);
    assert.equal(rejected.status, 2);
    assert.match(rejected.stdout + rejected.stderr, /Unsupported language/);

    const missing = runCli(['scaffold', '--lang', 'ts']);
    assert.equal(missing.status, 2);
    assert.match(missing.stdout + missing.stderr, /Missing mandatory argument: --name/);
  });

  it('skips existing files by default instead of overwriting them', () => {
    const dir = makeTempDir('scaffold-guard');
    try {
      assert.equal(runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir]).status, 0);
      const entity = path.join(dir, 'domain', 'entities', 'billing.entity.ts');
      fs.writeFileSync(entity, '// custom implementation\n');

      const rerun = runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir]);
      assert.equal(rerun.status, 0, rerun.stderr);
      assert.match(rerun.stdout, /Skipped existing/);
      assert.equal(fs.readFileSync(entity, 'utf-8'), '// custom implementation\n');
    } finally {
      removeDir(dir);
    }
  });

  it('backs up and overwrites existing files with --backup', () => {
    const dir = makeTempDir('scaffold-backup');
    try {
      assert.equal(runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir]).status, 0);
      const entity = path.join(dir, 'domain', 'entities', 'billing.entity.ts');
      fs.writeFileSync(entity, '// custom implementation\n');

      const rerun = runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir, '--backup']);
      assert.equal(rerun.status, 0, rerun.stderr);
      assert.match(fs.readFileSync(entity, 'utf-8'), /export class BillingEntity/);
      assert.equal(fs.readFileSync(`${entity}.bak`, 'utf-8'), '// custom implementation\n');
    } finally {
      removeDir(dir);
    }
  });

  it('overwrites existing files with --force', () => {
    const dir = makeTempDir('scaffold-force');
    try {
      assert.equal(runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir]).status, 0);
      const entity = path.join(dir, 'domain', 'entities', 'billing.entity.ts');
      fs.writeFileSync(entity, '// custom implementation\n');

      const rerun = runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir, '--force']);
      assert.equal(rerun.status, 0, rerun.stderr);
      assert.match(rerun.stdout, /Overwrote/);
      assert.match(fs.readFileSync(entity, 'utf-8'), /export class BillingEntity/);
      assert.equal(fs.existsSync(`${entity}.bak`), false);
    } finally {
      removeDir(dir);
    }
  });

  it('rejects combining --force and --backup', () => {
    const dir = makeTempDir('scaffold-flags');
    try {
      const result = runCli(['scaffold', '--name', 'billing', '--lang', 'ts', '--out', dir, '--force', '--backup']);
      assert.equal(result.status, 2);
      assert.match(result.stdout + result.stderr, /Cannot combine/);
    } finally {
      removeDir(dir);
    }
  });
});
