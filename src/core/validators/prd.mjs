/**
 * Product Requirement Document validator (Phase 2).
 */

import { emptyResult, finalize, readTarget } from './common.mjs';
import { hasHeading, sectionBody, findIds, hasBddStatements } from '../markdown.mjs';

export const REQUIRED_SECTIONS = [
  'Executive Summary',
  'Scope Boundaries',
  'Functional Requirements',
  'Non-Functional Requirements',
  'Data Flow',
  'Edge Cases',
  'Acceptance Criteria',
];

/**
 * @param {string} target
 */
export function validatePrd(target) {
  const result = emptyResult();
  const content = readTarget(target, result);
  if (content === null) return finalize(result);

  for (const section of REQUIRED_SECTIONS) {
    if (!hasHeading(content, new RegExp(section, 'i'), 2)) {
      result.errors.push(`Missing mandatory section: "## N. ${section}".`);
    }
  }

  const scope = sectionBody(content, /Scope Boundaries/i) || '';
  if (!/out of scope/i.test(scope)) {
    result.warnings.push('Explicit "Out of Scope" section is recommended to prevent agent scope creep.');
  }

  const functional = sectionBody(content, /Functional Requirements/i) || '';
  const frIds = findIds(functional, /FR-\d{3}/g);
  if (frIds.length === 0) {
    result.errors.push(
      'No functional requirement IDs found under Functional Requirements (expected FR-001, FR-002, ...).',
    );
  } else {
    const weak = functional
      .split('\n')
      .filter((line) => /FR-\d{3}/i.test(line))
      .filter((line) => line.replace(/FR-\d{3}/gi, '').replace(/[^a-zA-Z0-9]/g, '').length < 10);
    if (weak.length > 0) {
      result.errors.push(
        `Functional requirement(s) without substantive text: ${weak.map((line) => line.trim()).join('; ')}`,
      );
    }
  }

  const edgeCases = sectionBody(content, /Edge Cases/i) || '';
  const ecIds = findIds(edgeCases, /EC-\d{3}/gi);
  if (ecIds.length === 0 && !/edge case/i.test(edgeCases)) {
    result.warnings.push(
      'No explicit edge cases detected. Ensure boundary conditions and failure modes are documented.',
    );
  }

  const acceptance = sectionBody(content, /Acceptance Criteria/i) || '';
  const bddLines = acceptance.split('\n').map((line) => line.replace(/[*_`]/g, ''));
  const hasScenario = (keyword) =>
    bddLines.some((line) => {
      const parts = line.split(new RegExp(`\\b${keyword}\\b`, 'i'));
      if (parts.length < 2) return false;
      return (
        parts
          .slice(1)
          .join('')
          .replace(/[^a-zA-Z0-9]/g, '').length >= 10
      );
    });
  if (!hasBddStatements(acceptance) || !hasScenario('Given') || !hasScenario('When') || !hasScenario('Then')) {
    result.errors.push(
      'Acceptance criteria must include structured BDD scenarios: Given / When / Then with scenario text.',
    );
  }

  result.details = { functionalRequirements: frIds, edgeCases: ecIds };
  return finalize(result);
}
