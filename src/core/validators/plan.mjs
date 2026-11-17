/**
 * Project plan & risk register validator (Phase 1).
 */

import { emptyResult, finalize, readTarget } from './common.mjs';
import { hasHeading, sectionBody, findIds } from '../markdown.mjs';

export const REQUIRED_SECTIONS = [
  'Executive Vision & Objectives',
  'Milestone Roadmap',
  'Task Breakdown Structure',
  'Risk Register',
];

/**
 * @param {string} target
 */
export function validatePlan(target) {
  const result = emptyResult();
  const content = readTarget(target, result);
  if (content === null) return finalize(result);

  for (const section of REQUIRED_SECTIONS) {
    if (!hasHeading(content, new RegExp(section, 'i'), 2)) {
      result.errors.push(`Missing mandatory section: "## N. ${section}".`);
    }
  }

  const roadmap = sectionBody(content, /Milestone Roadmap/i) || '';
  const milestones = findIds(roadmap, /\bM\d+\b/g);
  if (milestones.length === 0) {
    result.errors.push('No milestones (e.g. M1, M2) identified in the roadmap.');
  }

  const risks = sectionBody(content, /Risk Register/i) || '';
  const riskIds = findIds(risks, /RSK-\d{3}/g);
  if (riskIds.length === 0) {
    result.warnings.push('No numbered risk IDs (RSK-001) found in the Risk Register.');
  }

  result.details = { milestones, risks: riskIds };
  return finalize(result);
}
