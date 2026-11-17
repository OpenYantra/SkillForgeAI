/**
 * Root Cause Analysis validator (Phase 7).
 */

import { emptyResult, finalize, readTarget } from './common.mjs';
import { hasHeading, sectionBody, findIds } from '../markdown.mjs';

export const REQUIRED_SECTIONS = ['Executive Summary', 'Incident Timeline', 'Root Cause', 'Remediation'];

/**
 * @param {string} target
 */
export function validateRca(target) {
  const result = emptyResult();
  const content = readTarget(target, result);
  if (content === null) return finalize(result);

  for (const section of REQUIRED_SECTIONS) {
    if (!hasHeading(content, new RegExp(section, 'i'), 2)) {
      result.errors.push(`Missing mandatory section containing "${section}".`);
    }
  }

  const incidentIds = findIds(content, /INC-\d+/gi);
  if (incidentIds.length === 0) {
    result.warnings.push('No incident ID (e.g. INC-101) identified in report.');
  }

  const remediation = sectionBody(content, /Remediation/i) || '';
  const actionItems = findIds(remediation, /ACT-\d{3}/g);
  if (actionItems.length === 0) {
    result.errors.push('No actionable remediation items (ACT-001) found in post-mortem.');
  }

  result.details = { incidentIds, actionItems };
  return finalize(result);
}
