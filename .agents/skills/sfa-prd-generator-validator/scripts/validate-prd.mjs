#!/usr/bin/env node
/**
 * PRD Validator Script
 * Validates that a Product Requirement Document (PRD) markdown file adheres
 * to Wave 1 SDLC standards before proceeding to code scaffolding.
 */

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  { name: 'Executive Summary / Problem Statement', regex: /##\s*1\.\s*Executive Summary/i },
  { name: 'Scope Boundaries (In / Out of Scope)', regex: /##\s*2\.\s*Scope Boundaries/i },
  { name: 'Functional Requirements', regex: /##\s*3\.\s*Functional Requirements/i },
  { name: 'Non-Functional Requirements', regex: /##\s*4\.\s*Non-Functional Requirements/i },
  { name: 'Data Flow & Interface Preview', regex: /##\s*5\.\s*Data Flow/i },
  { name: 'Edge Cases & Failure Modes', regex: /##\s*6\.\s*Edge Cases/i },
  { name: 'Acceptance Criteria', regex: /##\s*7\.\s*Acceptance Criteria/i },
];

function validatePrd(filePath) {
  if (!filePath) {
    console.error('❌ Error: Please specify a PRD markdown file path.\nUsage: node validate-prd.mjs <path-to-prd.md>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: File not found at "${resolvedPath}"`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const errors = [];
  const warnings = [];

  // 1. Check Required Sections
  for (const section of REQUIRED_SECTIONS) {
    if (!section.regex.test(content)) {
      errors.push(`Missing mandatory section: "${section.name}"`);
    }
  }

  // 2. Check Functional Requirements format (FR-XXX)
  const frMatches = content.match(/FR-\d{3}/g);
  if (!frMatches || frMatches.length === 0) {
    errors.push('No functional requirement IDs found (expected format: FR-001, FR-002, etc.).');
  }

  // 3. Check Acceptance Criteria BDD format (Given / When / Then)
  const hasGiven = /\*\*Given\*\*/i.test(content) || /Given\s+/i.test(content);
  const hasWhen = /\*\*When\*\*/i.test(content) || /When\s+/i.test(content);
  const hasThen = /\*\*Then\*\*/i.test(content) || /Then\s+/i.test(content);

  if (!hasGiven || !hasWhen || !hasThen) {
    errors.push('Acceptance criteria must include BDD statements (Given / When / Then).');
  }

  // 4. Check for Out-of-Scope definitions
  if (!/out of scope/i.test(content)) {
    warnings.push('Explicit "Out of Scope" section is recommended to prevent agent scope creep.');
  }

  // 5. Check for Edge Cases (EC-XXX or similar)
  if (!/EC-\d{3}/i.test(content) && !/edge case/i.test(content)) {
    warnings.push('No explicit edge cases detected. Ensure boundary conditions and failure modes are documented.');
  }

  console.log('\n========================================');
  console.log(`📋 PRD Validation Report: ${path.basename(resolvedPath)}`);
  console.log('========================================');

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Validation Errors Found:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease fix the issues above before moving to Phase 4 (Scaffolding).\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: PRD meets all Wave 1 specification standards!');
    console.log(`   Functional Requirements Identified: ${frMatches ? [...new Set(frMatches)].join(', ') : 'None'}`);
    console.log('   Ready for Phase 4: `sfa-feature-scaffolder`.\n');
    process.exit(0);
  }
}

const targetFile = process.argv[2];
validatePrd(targetFile);
