/**
 * Test Suite: self-healing engine.
 * Covers improvement.md #13 (bounded loop + monorepo discovery).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  detectTestProject,
  discoverTestProjects,
  extractDiagnostics,
  runHealLoop,
  writeIncidentPackage,
} from '../src/core/heal.mjs';
import { makeTempDir, removeDir, writeFiles, runNode, REPO_ROOT } from './helpers/workspace.ts';

function inDir<T>(dir: string, fn: () => T): T {
  const previous = process.cwd();
  try {
    process.chdir(dir);
    return fn();
  } finally {
    process.chdir(previous);
  }
}

describe('test project detection', () => {
  it('detects Node, Python, Go, and .NET projects', () => {
    const dir = makeTempDir('heal-detect');
    try {
      writeFiles(dir, { 'node/package.json': JSON.stringify({ scripts: { test: 'node --test' } }) });
      writeFiles(dir, { 'python/pyproject.toml': '[project]\nname="demo"\n' });
      writeFiles(dir, { 'golang/go.mod': 'module demo\n' });
      writeFiles(dir, { 'dotnet/demo.sln': 'Microsoft Visual Studio Solution File\n' });

      assert.equal(detectTestProject(path.join(dir, 'node'))?.stack, 'node');
      assert.equal(detectTestProject(path.join(dir, 'python'))?.stack, 'python');
      assert.equal(detectTestProject(path.join(dir, 'golang'))?.stack, 'go');
      assert.equal(detectTestProject(path.join(dir, 'dotnet'))?.stack, 'dotnet');
      assert.equal(detectTestProject(path.join(dir, 'node', 'missing')), null);
    } finally {
      removeDir(dir);
    }
  });

  it('discovers monorepo child projects and respects maxDepth', () => {
    const dir = makeTempDir('heal-monorepo');
    try {
      writeFiles(dir, {
        'services/a/package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
        'services/b/package.json': JSON.stringify({ scripts: { test: 'vitest' } }),
        'deep/one/two/package.json': JSON.stringify({ scripts: { test: 'jest' } }),
      });

      inDir(dir, () => {
        const projects = discoverTestProjects('.', { maxDepth: 2 });
        assert.deepEqual(
          projects.map((project) => project.root),
          ['services/a', 'services/b'],
        );
      });
    } finally {
      removeDir(dir);
    }
  });

  it('prefers the root project unless --all is requested', () => {
    const dir = makeTempDir('heal-root');
    try {
      writeFiles(dir, {
        'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
        'services/a/package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
      });

      inDir(dir, () => {
        assert.deepEqual(
          discoverTestProjects('.').map((project) => project.root),
          ['.'],
        );
        assert.deepEqual(
          discoverTestProjects('.', { all: true }).map((project) => project.root),
          ['.', 'services/a'],
        );
      });
    } finally {
      removeDir(dir);
    }
  });
});

describe('bounded heal loop', () => {
  const project = { root: '.', dir: process.cwd(), stack: 'node', command: 'npm', args: ['test'] };

  it('retries after a fixer and stops on success', () => {
    let fixed = false;
    let attempts = 0;

    const report = runHealLoop({
      projects: [project],
      maxIterations: 3,
      fixScript: 'fixer.mjs',
      runner: () => {
        attempts++;
        return fixed
          ? { status: 0, stdout: 'ok', stderr: '' }
          : { status: 1, stdout: 'AssertionError: boom', stderr: '' };
      },
      fixer: () => {
        fixed = true;
        return { status: 0, stdout: 'fixed', stderr: '' };
      },
    });

    assert.equal(report.passed, true);
    assert.equal(report.projects[0].attempts, 2);
    assert.equal(report.projects[0].passed, true);
    assert.equal(attempts, 2);
  });

  it('runs once when no fixer is provided', () => {
    const report = runHealLoop({
      projects: [project],
      maxIterations: 5,
      runner: () => ({ status: 1, stdout: 'Expected 1 Received 2', stderr: '' }),
    });

    assert.equal(report.passed, false);
    assert.equal(report.projects[0].attempts, 1);
    assert.match(report.projects[0].diagnostics, /Expected/);
  });

  it('stops when the fixer fails', () => {
    const report = runHealLoop({
      projects: [project],
      maxIterations: 5,
      fixScript: 'fixer.mjs',
      runner: () => ({ status: 1, stdout: 'error: broken', stderr: '' }),
      fixer: () => ({ status: 1, stdout: '', stderr: 'fixer crashed' }),
    });

    assert.equal(report.passed, false);
    assert.equal(report.projects[0].attempts, 1);
    assert.match(report.projects[0].diagnostics, /fixer crashed/);
  });

  it('extracts the most relevant failure lines', () => {
    const diagnostics = extractDiagnostics({
      stdout: 'noise\nAssertionError: nope\nExpected: 1\nmore noise',
      stderr: '',
    });
    assert.match(diagnostics, /AssertionError/);
    assert.match(diagnostics, /Expected/);
    assert.doesNotMatch(diagnostics, /noise/);
  });
});

describe('incident package', () => {
  it('writes failing projects and remediation instructions', () => {
    const dir = makeTempDir('heal-incident');
    try {
      const file = path.join(dir, 'docs', 'context', 'LATEST-TEST-FAILURE.json');
      const report = {
        generatedAt: new Date().toISOString(),
        iterations: 1,
        passed: false,
        projects: [
          {
            root: 'services/a',
            dir: '/tmp/a',
            stack: 'node',
            testRunner: 'npm test',
            attempts: 1,
            passed: false,
            diagnostics: 'boom',
          },
        ],
      };

      writeIncidentPackage(report, file);
      const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
      assert.deepEqual(saved.failingProjects, ['services/a']);
      assert.ok(Array.isArray(saved.remediationInstructions));
      assert.match(saved.projects[0].diagnostics, /boom/);
    } finally {
      removeDir(dir);
    }
  });
});

describe('self-heal-loop CLI', () => {
  it('prints the detected monorepo plan in dry-run mode', () => {
    const dir = makeTempDir('heal-cli');
    try {
      writeFiles(dir, {
        'services/a/package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
        'services/b/package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
      });
      const result = runNode(path.join(REPO_ROOT, 'scripts', 'self-heal-loop.mjs'), ['--dry-run'], dir);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /services\/a/);
      assert.match(result.stdout, /services\/b/);
      assert.match(result.stdout, /Dry run complete/);
    } finally {
      removeDir(dir);
    }
  });

  it('fails with guidance when no test project is detected', () => {
    const dir = makeTempDir('heal-empty');
    try {
      const result = runNode(path.join(REPO_ROOT, 'scripts', 'self-heal-loop.mjs'), [], dir);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /No test projects detected/);
    } finally {
      removeDir(dir);
    }
  });
});
