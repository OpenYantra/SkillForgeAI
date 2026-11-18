/**
 * AUD-S: Human-in-the-Loop sign-off bypasses.
 *
 * Each test asserts the cryptographic / identity guarantee the framework
 * claims and is expected to FAIL against the current implementation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifySignOff } from '../../src/core/signoff-verify.mjs';
import { isAgentIdentity } from '../../src/core/governance.mjs';
import {
  commitAll,
  gitStub,
  initGitRepo,
  makeTempDir,
  projectConfig,
  removeDir,
  runGit,
  sha256,
  signoffDoc,
  writeFiles,
} from './helpers/audit.ts';

function withSignoff<T>(content: string, fn: (file: string) => T): T {
  const dir = makeTempDir('audit-signoff-doc');
  try {
    const file = path.join(dir, 'signoff.md');
    fs.writeFileSync(file, content);
    return fn(file);
  } finally {
    removeDir(dir);
  }
}

const humanGov = {
  allowedReviewers: ['human@corp.com'],
  requireSignedCommits: true,
  signoffTtlDays: 3650,
  allowAgentIdentities: false,
};

describe('AUD-S: sign-off integrity', () => {
  it('AUD-S01: an uncommitted working-tree APPROVED edit must not be accepted', () => {
    const dir = makeTempDir('audit-signoff-wt');
    try {
      initGitRepo(dir);
      const relative = 'docs/approvals/demo-signoff.md';

      writeFiles(dir, {
        [relative]: signoffDoc({
          status: 'PENDING_REVIEW',
          hash: '',
          authorization: '- [ ] Authorized to proceed',
        }),
      });
      commitAll(dir, 'chore: draft signoff');

      writeFiles(dir, {
        [relative]: signoffDoc({
          status: 'APPROVED',
          hash: '',
          authorization: '- [x] Authorized to proceed',
        }),
      });

      const file = path.join(dir, relative);
      const result = verifySignOff(file, {
        config: projectConfig({
          governance: {
            allowedReviewers: ['tests@example.com'],
            requireSignedCommits: false,
            signoffTtlDays: 3650,
            allowAgentIdentities: false,
          },
        }),
        runGit: (args: string[]) => runGit(args, dir).stdout.trim(),
        silent: true,
      });

      assert.equal(
        result.passed,
        false,
        'the APPROVED text came from an uncommitted working-tree edit but verification used the older signed commit',
      );
    } finally {
      removeDir(dir);
    }
  });

  it('AUD-S02: approval must be bound to the approved artifact content', () => {
    const prd = 'The payment total must never be negative.';
    withSignoff(
      signoffDoc({
        extraLines: ['- **Artifact Path:** docs/prd.md', `- **Artifact Hash:** ${sha256(prd)}`],
      }),
      (file) => {
        const dir = path.dirname(file);
        writeFiles(dir, { 'docs/prd.md': prd });

        const before = verifySignOff(file, {
          config: projectConfig({ governance: humanGov }),
          runGit: () => gitStub(),
          silent: true,
        });
        assert.equal(before.passed, true, 'baseline approval should be valid');

        writeFiles(dir, { 'docs/prd.md': 'The payment total must be negative.' });
        const after = verifySignOff(file, {
          config: projectConfig({ governance: humanGov }),
          runGit: () => gitStub(),
          silent: true,
        });

        assert.equal(
          after.passed,
          false,
          'the approved artifact changed after approval but the sign-off still verified (no content binding)',
        );
      },
    );
  });

  it('AUD-S03: a valid signature from a non-allow-listed signing key must be rejected', () => {
    withSignoff(signoffDoc(), (file) => {
      const result = verifySignOff(file, {
        config: projectConfig({ governance: humanGov }),
        runGit: () => `${gitStub()}|attacker@evil.com`,
        silent: true,
      });

      assert.equal(
        result.passed,
        false,
        'commit author was allow-listed but the signing key UID was an attacker; %G? alone accepted it',
      );
    });
  });

  it('AUD-S04: TTL must use the human approval date, not the forgeable committer date', () => {
    withSignoff(signoffDoc({ date: '2020-01-01', hash: 'abc123' }), (file) => {
      const result = verifySignOff(file, {
        config: projectConfig({ governance: { ...humanGov, signoffTtlDays: 30 } }),
        runGit: () => gitStub('abc123', 'human@corp.com', 'G', new Date().toISOString()),
        silent: true,
      });

      assert.equal(
        result.passed,
        false,
        'approval was dated 2020-01-01 but a fresh committer date made a 30-day TTL pass',
      );
    });
  });

  it('AUD-S05: agent identity denylist must cover common coding agents', () => {
    const identities = [
      'agent@cursor.com',
      'devin@cognition.ai',
      'aider@localhost',
      'gemini-code-assist@google.com',
      'codex@openai.com',
      'assistant@anthropic.com',
    ];

    for (const identity of identities) {
      assert.equal(isAgentIdentity(identity), true, `automated identity "${identity}" was treated as human`);
    }
  });

  it('AUD-S06: "Authorized to proceed" inside a fenced code block must not count', () => {
    withSignoff(signoffDoc({ authorization: '```\n- [x] Authorized to proceed\n```' }), (file) => {
      const result = verifySignOff(file, {
        config: projectConfig({ governance: humanGov }),
        runGit: () => gitStub(),
        silent: true,
      });

      assert.equal(result.passed, false, 'authorization text inside a fenced code block satisfied the gate');
    });
  });

  it('AUD-S07: self-test attestations must be machine-flagged as demo-only', () => {
    withSignoff(signoffDoc(), (file) => {
      const result = verifySignOff(file, {
        config: { mode: 'self-test', governance: {} } as any,
        runGit: () => {
          throw new Error('git must not run in self-test mode');
        },
        silent: true,
      }) as any;

      assert.equal(result.demo, true, 'self-test mode returns passed=true without a machine-readable demo flag');
    });
  });
});
