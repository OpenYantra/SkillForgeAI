/**
 * Security audit adapter for the in-process gate runner (Phase 6).
 */

import fs from 'node:fs';
import { emptyResult, finalize } from './common.mjs';
import { runSecurityAudit } from '../security-audit.mjs';

/**
 * @param {string} target file or directory
 * @param {{strict?: boolean}} [options]
 */
export function validateSecurity(target, options = {}) {
  const result = emptyResult();
  if (!target || !fs.existsSync(target)) {
    result.errors.push(target ? `Target not found at "${target}".` : 'Please specify a target path.');
    return finalize(result);
  }

  const report = runSecurityAudit({ target, strict: Boolean(options.strict), silent: true });

  if (report.status === 'FAILED') {
    const criticalHigh = (report.findings || []).filter(
      (finding) => finding.severity === 'CRITICAL' || finding.severity === 'HIGH',
    );
    result.errors.push(
      `Security audit failed: ${(report.findings || []).length} finding(s), including ${criticalHigh.length} critical/high.`,
    );
    for (const finding of criticalHigh.slice(0, 5)) {
      result.errors.push(`${finding.ruleId} ${finding.name} at ${finding.file}:${finding.line}`);
    }
  }

  const warnings = (report.findings || []).filter(
    (finding) => finding.severity === 'MEDIUM' || finding.severity === 'LOW',
  );
  for (const finding of warnings.slice(0, 10)) {
    result.warnings.push(`${finding.ruleId} ${finding.name} at ${finding.file}:${finding.line}`);
  }

  result.details = {
    filesScanned: report.filesScanned || 0,
    findings: (report.findings || []).length,
    critical: (report.findings || []).filter((f) => f.severity === 'CRITICAL').length,
    high: (report.findings || []).filter((f) => f.severity === 'HIGH').length,
  };
  return finalize(result);
}
