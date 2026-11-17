/**
 * Architecture specification & ADR validator (Phase 3).
 */

import { emptyResult, finalize, readTarget } from './common.mjs';
import { hasHeading, sectionBody, countFencedBlocks, findIds } from '../markdown.mjs';

export const REQUIRED_SECTIONS = [
  'Architectural Drivers',
  'System Context',
  'Container & Component',
  'Architectural Boundaries',
  'Security',
  'Index of Architecture Decision Records',
];

/**
 * @param {string} target
 */
export function validateArchitecture(target) {
  const result = emptyResult();
  const content = readTarget(target, result);
  if (content === null) return finalize(result);

  for (const section of REQUIRED_SECTIONS) {
    if (!hasHeading(content, new RegExp(section, 'i'), 2)) {
      result.errors.push(`Missing mandatory section containing "${section}".`);
    }
  }

  const mermaidBlocks = countFencedBlocks(content, 'mermaid');
  if (mermaidBlocks < 2) {
    result.errors.push(`Expected at least 2 Mermaid diagrams (C4 Context and C4 Container), found ${mermaidBlocks}.`);
  }

  const adrSection = sectionBody(content, /Index of Architecture Decision Records/i) || '';
  const adrIds = findIds(adrSection, /ADR-\d{4}/g);
  if (adrIds.length === 0) {
    result.warnings.push('No ADR references (e.g., ADR-0001) found. Architectural decisions should be recorded.');
  }

  result.details = { mermaidBlocks, adrs: adrIds };
  return finalize(result);
}
