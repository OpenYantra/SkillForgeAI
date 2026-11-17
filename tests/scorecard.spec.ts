/**
 * Test Suite: PR Scorecard Synthesizer
 * Verifies that the scorecard fails closed (never reports success) when the gate
 * report is missing or gates fail, and reports success only on a PASSED report.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateScorecard } from '../scripts/generate-pr-scorecard.mjs';

const SCRIPT = path.resolve('scripts/generate-pr-scorecard.mjs');

function tempFile(name: string): string {
  return path.join(os.tmpdir(), `sfa-scorecard-${Date.now()}-${Math.random().toString(16).slice(2)}-${name}`);
}

describe('generateScorecard', () => {
  const diff = { highestSeverity: 'PATCH', totalChangedFiles: 0 };

  it('renders MISSING and blocks merge when the gate report is absent', () => {
    const md = generateScorecard(diff, { status: 'MISSING', totalGates: 0, passed: 0, failed: 0, missing: true });

    assert.match(md, /GATE REPORT MISSING/);
    assert.match(md, /Merge Blocked/);
    assert.doesNotMatch(md, /safe to merge/i);
    assert.doesNotMatch(md, /QUALITY GATES PASSED/);
  });

  it('blocks merge and reports failure when gates fail', () => {
    const md = generateScorecard(diff, {
      status: 'FAILED',
      totalGates: 2,
      passed: 1,
      failed: 1,
      gates: [
        { phase: 1, name: 'Phase 1: Planning', status: 'PASSED' },
        { phase: 2, name: 'Phase 2: PRD', status: 'FAILED' },
      ],
    });

    assert.match(md, /ONE OR MORE SDLC GATES FAILED/);
    assert.match(md, /Merge Blocked/);
    assert.doesNotMatch(md, /safe to merge/i);
    assert.match(md, /❌ FAILED/);
  });

  it('reports success only when all gates pass', () => {
    const md = generateScorecard(diff, {
      status: 'PASSED',
      totalGates: 10,
      passed: 10,
      failed: 0,
      gates: [{ phase: 1, name: 'Phase 1: Planning', status: 'PASSED' }],
    });

    assert.match(md, /ALL 10 SDLC QUALITY GATES PASSED/);
    assert.match(md, /safe to merge/i);
  });

  it('renders SKIPPED gates distinctly', () => {
    const md = generateScorecard(diff, {
      status: 'PASSED',
      totalGates: 1,
      passed: 1,
      failed: 0,
      skipped: 1,
      gates: [{ phase: 2, name: 'Phase 2/3: API Contract', status: 'SKIPPED' }],
    });

    assert.match(md, /SKIPPED/);
    assert.match(md, /Artifact not configured/);
  });
});

describe('generate-pr-scorecard CLI', () => {
  it('exits non-zero and prints MISSING when the gate report does not exist', () => {
    const out = tempFile('scorecard.md');
    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--diff', tempFile('missing-diff.json'), '--gate', tempFile('missing-gate.json'), '--out', out],
      { encoding: 'utf-8' },
    );

    try {
      assert.notEqual(result.status, 0);
      assert.ok(fs.existsSync(out), 'scorecard file should still be written for posting');
      const md = fs.readFileSync(out, 'utf-8');
      assert.match(md, /GATE REPORT MISSING|cannot be certified/i);
      assert.doesNotMatch(md, /safe to merge/i);
    } finally {
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });

  it('exits zero when a PASSED gate report is provided', () => {
    const gateFile = tempFile('gate.json');
    const out = tempFile('scorecard.md');
    fs.writeFileSync(gateFile, JSON.stringify({ status: 'PASSED', totalGates: 10, passed: 10, failed: 0, gates: [] }));

    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--diff', tempFile('missing-diff.json'), '--gate', gateFile, '--out', out],
      { encoding: 'utf-8' },
    );

    try {
      assert.equal(result.status, 0);
      assert.match(fs.readFileSync(out, 'utf-8'), /safe to merge/i);
    } finally {
      if (fs.existsSync(gateFile)) fs.unlinkSync(gateFile);
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });

  it('surfaces malformed report JSON instead of silently defaulting', () => {
    const gateFile = tempFile('bad-gate.json');
    const out = tempFile('scorecard.md');
    fs.writeFileSync(gateFile, '{ this is not json');

    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--diff', tempFile('missing-diff.json'), '--gate', gateFile, '--out', out],
      { encoding: 'utf-8' },
    );

    try {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /not valid JSON/);
      assert.match(fs.readFileSync(out, 'utf-8'), /Report Integrity/);
    } finally {
      if (fs.existsSync(gateFile)) fs.unlinkSync(gateFile);
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  });
});
