/**
 * Test Suite: Security Vulnerability & Weakness Auditor
 * Validates detection of hacker-targetable weaknesses (OWASP Top 10, CWE Top 25)
 * and verifies that clean application code passes without false positives.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scanFile,
  runSecurityAudit,
} from '../.agents/skills/sfa-security-vulnerability-auditor/scripts/audit-security.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

describe('Security Vulnerability Auditor', () => {
  it('should pass with 0 findings on clean application code (examples/order-service/src)', () => {
    const result = runSecurityAudit({
      target: 'examples/order-service/src',
    });

    assert.equal(result.status, 'PASSED');
    assert.equal(result.findings.length, 0);
  });

  it('should flag SQL Injection (CWE-89) in dynamic string queries', () => {
    const tempFile = path.join(os.tmpdir(), `test-sqli-${Date.now()}.ts`);
    const code = `
      export async function getUser(db: any, id: string) {
        return db.query("SELECT * FROM users WHERE id = " + id);
      }
    `;
    fs.writeFileSync(tempFile, code);

    try {
      const findings = scanFile(tempFile);
      const sqli = findings.find((f) => f.cwe === 'CWE-89');
      assert.ok(sqli, 'Expected CWE-89 SQL Injection finding');
      assert.equal(sqli.severity, 'CRITICAL');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('should flag OS Command Injection (CWE-78) when user input is concatenated into shell commands', () => {
    const tempFile = path.join(os.tmpdir(), `test-cmdi-${Date.now()}.ts`);
    const code = `
      import { exec } from 'node:child_process';
      export function convertImage(userFilename: string) {
        exec("convert " + userFilename + " out.png");
      }
    `;
    fs.writeFileSync(tempFile, code);

    try {
      const findings = scanFile(tempFile);
      const cmdi = findings.find((f) => f.cwe === 'CWE-78');
      assert.ok(cmdi, 'Expected CWE-78 Command Injection finding');
      assert.equal(cmdi.severity, 'CRITICAL');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('should flag Arbitrary Code Execution (CWE-94) in eval() calls', () => {
    const tempFile = path.join(os.tmpdir(), `test-eval-${Date.now()}.ts`);
    const code = `
      export function calculate(expression: string) {
        return eval(expression);
      }
    `;
    fs.writeFileSync(tempFile, code);

    try {
      const findings = scanFile(tempFile);
      const evalFinding = findings.find((f) => f.cwe === 'CWE-94');
      assert.ok(evalFinding, 'Expected CWE-94 Code Execution finding');
      assert.equal(evalFinding.severity, 'CRITICAL');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('should flag exposed AWS Access Keys and Private Keys (CWE-798)', () => {
    const tempFile = path.join(os.tmpdir(), `test-secrets-${Date.now()}.ts`);
    const code = `
      const awsKey = "AKIA1234567890ABCDEF";
      const keyHeader = "-----BEGIN RSA PRIVATE KEY-----";
    `;
    fs.writeFileSync(tempFile, code);

    try {
      const findings = scanFile(tempFile);
      const secretFindings = findings.filter((f) => f.cwe === 'CWE-798');
      assert.ok(secretFindings.length >= 2, 'Expected at least 2 CWE-798 secret findings');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('should flag Broken Cryptography (CWE-328) when MD5 hash is instantiated', () => {
    const tempFile = path.join(os.tmpdir(), `test-crypto-${Date.now()}.ts`);
    const code = `
      import crypto from 'node:crypto';
      export function hashPassword(pwd: string) {
        return crypto.createHash('md5').update(pwd).digest('hex');
      }
    `;
    fs.writeFileSync(tempFile, code);

    try {
      const findings = scanFile(tempFile);
      const md5Finding = findings.find((f) => f.cwe === 'CWE-328');
      assert.ok(md5Finding, 'Expected CWE-328 Broken Hash finding');
      assert.equal(md5Finding.severity, 'MEDIUM');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('should flag Disabled TLS Certificate Validation (CWE-295)', () => {
    const tempFile = path.join(os.tmpdir(), `test-tls-${Date.now()}.ts`);
    const code = `
      import https from 'node:https';
      const agent = new https.Agent({ rejectUnauthorized: false });
    `;
    fs.writeFileSync(tempFile, code);

    try {
      const findings = scanFile(tempFile);
      const tlsFinding = findings.find((f) => f.cwe === 'CWE-295');
      assert.ok(tlsFinding, 'Expected CWE-295 Disabled TLS finding');
      assert.equal(tlsFinding.severity, 'CRITICAL');
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  it('should support JSON output mode via CLI', () => {
    const output = execSync('node bin/skillforge.mjs security --path examples/order-service/src --json', {
      encoding: 'utf-8',
    });

    const parsed = JSON.parse(output);
    assert.equal(parsed.status, 'PASSED');
    assert.equal(parsed.findings.length, 0);
    assert.ok(parsed.filesScanned > 0);
  });

  it('fails closed and reports scan errors for a missing target', () => {
    const missing = path.join(os.tmpdir(), `sfa-missing-${Date.now()}`);
    const result = runSecurityAudit({ target: missing, silent: true });

    assert.equal(result.status, 'FAILED');
    assert.ok(Array.isArray(result.errors));
    assert.ok(result.errors.some((error) => error.kind === 'target'));
  });
});
