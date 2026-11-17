/**
 * Test Suite: HITL Sign-Off Governance
 * Verifies that a sign-off is only accepted in project mode when its commit is
 * authored by an allow-listed, non-agent human, is signed, matches the recorded
 * hash, and is within TTL. Also verifies that `signoff` only emits drafts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifySignOff } from '../scripts/verify-human-signoff.mjs';
import { isAgentIdentity, isAllowedReviewer, isExpired } from '../src/core/governance.mjs';

const BIN = path.resolve('bin/skillforge.mjs');

function writeSignoff(overrides: Record<string, string> = {}): string {
  const o = {
    status: 'APPROVED',
    reviewer: 'Dana Human',
    date: '2026-11-10',
    hash: 'abc123',
    ...overrides,
  };
  const content = `# SDLC Phase Sign-Off: demo

- **Target Phase:** Phase 3
- **Status:** ${o.status}
- **Reviewed By (Human):** ${o.reviewer}
- **Reviewer Role:** Lead Architect
- **Approval Date:** ${o.date}
- **Commit / Artifact Hash:** ${o.hash}

---

## 1. Review Checklist & Verification
- [x] Scope and non-goals are clearly bounded.

---

## 2. Reviewer Notes & Approvals

**Authorized Next Phase:**
- [x] Authorized to proceed to **Phase 4: Feature Scaffolding & Implementation**
`;
  const file = path.join(os.tmpdir(), `sfa-signoff-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
  fs.writeFileSync(file, content);
  return file;
}

const projectConfig = (gov: Record<string, unknown> = {}) => ({
  mode: 'project',
  governance: {
    allowedReviewers: ['human@corp.com'],
    requireSignedCommits: true,
    signoffTtlDays: 3650,
    allowAgentIdentities: false,
    ...gov,
  },
});

const commitLine =
  (email = 'human@corp.com', sig = 'G', hash = 'abc123', date = '2026-11-15T00:00:00Z') =>
  () =>
    `${hash}|${email}|${sig}|${date}`;

describe('governance helpers', () => {
  it('detects agent/bot identities and allow-list membership', () => {
    assert.equal(isAgentIdentity('copilot@github.com'), true);
    assert.equal(isAgentIdentity('41898282+github-actions[bot]@users.noreply.github.com'), true);
    assert.equal(isAgentIdentity('human@corp.com'), false);
    assert.equal(isAllowedReviewer('HR@Corp.com', ['human@corp.com']), false);
    assert.equal(isAllowedReviewer('human@corp.com', ['Human@Corp.com']), true);
  });

  it('computes TTL expiry', () => {
    assert.equal(isExpired('2020-01-01T00:00:00Z', 30), true);
    assert.equal(isExpired(new Date().toISOString(), 30), false);
    assert.equal(isExpired('2020-01-01T00:00:00Z', 0), false);
  });
});

describe('verifySignOff — structural checks', () => {
  it('rejects a PENDING_REVIEW draft', () => {
    const file = writeSignoff({ status: 'PENDING_REVIEW' });
    try {
      const result = verifySignOff(file, { config: projectConfig(), runGit: commitLine() });
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((e) => /not APPROVED/i.test(e)));
    } finally {
      fs.unlinkSync(file);
    }
  });
});

describe('verifySignOff — project governance', () => {
  it('accepts an allow-listed, signed human sign-off with a matching hash', () => {
    const file = writeSignoff();
    try {
      const result = verifySignOff(file, { config: projectConfig(), runGit: commitLine() });
      assert.equal(result.passed, true, result.errors.join('; '));
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('rejects a reviewer not in the allow-list', () => {
    const file = writeSignoff();
    try {
      const result = verifySignOff(file, { config: projectConfig(), runGit: commitLine('stranger@evil.com') });
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((e) => /allowedReviewers/i.test(e)));
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('rejects an agent/bot author', () => {
    const file = writeSignoff();
    try {
      const result = verifySignOff(file, {
        config: projectConfig({ allowedReviewers: ['copilot@github.com'] }),
        runGit: commitLine('copilot@github.com'),
      });
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((e) => /agent/i.test(e)));
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('rejects unsigned commits when signing is required', () => {
    const file = writeSignoff();
    try {
      const result = verifySignOff(file, { config: projectConfig(), runGit: commitLine('human@corp.com', 'N') });
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((e) => /signed commit/i.test(e)));
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('rejects a mismatched recorded hash', () => {
    const file = writeSignoff({ hash: 'deadbeef' });
    try {
      const result = verifySignOff(file, {
        config: projectConfig(),
        runGit: commitLine('human@corp.com', 'G', 'abc123'),
      });
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((e) => /does not match/i.test(e)));
    } finally {
      fs.unlinkSync(file);
    }
  });

  it('rejects an expired sign-off', () => {
    const file = writeSignoff();
    try {
      const result = verifySignOff(file, {
        config: projectConfig({ signoffTtlDays: 1 }),
        runGit: commitLine('human@corp.com', 'G', 'abc123', '2020-01-01T00:00:00Z'),
      });
      assert.equal(result.passed, false);
      assert.ok(result.errors.some((e) => /TTL/i.test(e)));
    } finally {
      fs.unlinkSync(file);
    }
  });
});

describe('verifySignOff — self-test mode', () => {
  it('passes structurally with a warning and skips git checks', () => {
    const file = writeSignoff();
    try {
      const result = verifySignOff(file, {
        config: { mode: 'self-test', governance: {} },
        runGit: () => {
          throw new Error('git must not be invoked in self-test mode');
        },
      });
      assert.equal(result.passed, true, result.errors.join('; '));
      assert.ok(result.warnings.some((w) => /self-test/i.test(w)));
    } finally {
      fs.unlinkSync(file);
    }
  });
});

describe('signoff CLI', () => {
  it('generates a PENDING_REVIEW draft and never an approval', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfa-signoff-cli-'));
    try {
      const result = spawnSync(
        process.execPath,
        [BIN, 'signoff', '--feature', 'governance-demo', '--by', 'Dana Human'],
        { cwd: dir, encoding: 'utf-8' },
      );
      assert.equal(result.status, 0, result.stderr);
      const draftPath = path.join(dir, 'docs', 'approvals', 'governance-demo-signoff.md');
      assert.ok(fs.existsSync(draftPath), 'draft sign-off should be written');
      const draft = fs.readFileSync(draftPath, 'utf-8');
      assert.match(draft, /Status:\*\* PENDING_REVIEW/);
      assert.doesNotMatch(draft, /\[x\] Authorized to proceed/i);
      assert.match(draft, /- \[ \]/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
