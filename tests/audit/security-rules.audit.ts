/**
 * AUD-R: Security auditor correctness and coverage.
 *
 * These tests assert that documented vulnerability classes are actually
 * detected. They are expected to FAIL where the rule engine is broken or the
 * scan policy hides the vulnerability.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runSecurityAudit, scanFile } from '../../src/core/security-audit.mjs';
import { validateSecurity } from '../../src/core/validators/security.mjs';
import {
  commitAll,
  fixture,
  frameworkModule,
  initGitRepo,
  makeTempDir,
  removeDir,
  runNodeInDir,
  writeFiles,
} from './helpers/audit.ts';

const ALL_RULE_IDS = [
  'SEC-001',
  'SEC-002',
  'SEC-003',
  'SEC-004',
  'SEC-005',
  'SEC-006',
  'SEC-007',
  'SEC-008',
  'SEC-009',
  'SEC-010',
  'SEC-011',
  'SEC-012',
  'SEC-013',
  'SEC-014',
  'SEC-015',
  'SEC-016',
];

describe('AUD-R: security rule engine', () => {
  it('AUD-R01: SEC-004 must flag a hardcoded credential assignment', () => {
    const findings = scanFile(fixture('security', 'hardcoded-password.ts'));
    assert.ok(
      findings.some((finding: any) => finding.ruleId === 'SEC-004'),
      'SEC-004 (CWE-798 hardcoded credential) never fires; its regex is dead',
    );
  });

  it('AUD-R02: secrets on comment lines must still be reported', () => {
    const findings = scanFile(fixture('security', 'secret-in-comment.env'));
    const ids = findings.map((finding: any) => finding.ruleId);
    assert.ok(ids.includes('SEC-002'), 'AWS key hidden on a "#" comment line was not reported');
    assert.ok(ids.includes('SEC-004'), 'password assignment in .env was not reported');
  });

  it('AUD-R03: multi-line permissive CORS with credentials must be reported', () => {
    const findings = scanFile(fixture('security', 'cors-multiline.ts'));
    assert.ok(
      findings.some((finding: any) => finding.ruleId === 'SEC-014'),
      'SEC-014 only matches when origin/credentials share a line; formatted code evades it',
    );
  });

  it('AUD-R04: build outputs are excluded by default and scanned on opt-in', () => {
    const defaults = runSecurityAudit({ target: fixture('security', 'dist'), silent: true });
    assert.equal(defaults.findings.length, 0, 'build outputs are documented as out of scope by default');

    const optIn = runSecurityAudit({
      target: fixture('security', 'dist'),
      includeBuildOutput: true,
      silent: true,
    });
    assert.ok(optIn.findings.length > 0, '--include-build-output must scan dist/');
  });

  it('AUD-R05: every documented SEC-* rule must have a live positive match', () => {
    const findings = scanFile(fixture('security', 'all-rules.ts'));
    const seen = new Set(findings.map((finding: any) => finding.ruleId));
    const missing = ALL_RULE_IDS.filter((id) => !seen.has(id));
    assert.deepEqual(missing, [], `rules without a positive match: ${missing.join(', ')}`);
  });

  it('AUD-R06: MEDIUM weaknesses (MD5) must block the security gate by default', () => {
    const dir = makeTempDir('audit-md5');
    try {
      fs.copyFileSync(fixture('security', 'md5-auth.ts'), path.join(dir, 'md5-auth.ts'));
      const result: any = validateSecurity(dir);
      assert.ok(result.errors.length > 0, 'MD5 password hashing was demoted to a warning and did not block the gate');
    } finally {
      removeDir(dir);
    }
  });

  it('AUD-R07: --diff must include untracked new files', () => {
    const dir = makeTempDir('audit-diff');
    try {
      initGitRepo(dir);
      writeFiles(dir, { 'clean.ts': 'export class Clean {}\n' });
      commitAll(dir, 'chore: baseline');
      writeFiles(dir, { 'leaked.ts': "const key = 'AKIAIOSFODNN7EXAMPLE';\n" });

      const code = `import { runSecurityAudit } from '${frameworkModule('src/core/security-audit.mjs')}';
const report = runSecurityAudit({ diff: true, silent: true });
console.log(JSON.stringify({ files: report.filesScanned, findings: report.findings.map((finding) => finding.file) }));`;
      const output = runNodeInDir(dir, code).trim().split('\n').pop() || '';
      const report = JSON.parse(output) as { files: number; findings: string[] };

      assert.ok(report.findings.length > 0, 'git diff HEAD excludes untracked files, so leaked.ts was never scanned');
    } finally {
      removeDir(dir);
    }
  });
});
