#!/usr/bin/env node
/**
 * Project Plan & Risk Register Validator
 * Validates that a project plan markdown document adheres to Phase 1 standards:
 * - Contains Milestone Roadmap & WBS.
 * - Outlines prioritized task breakdowns.
 * - Includes a structured Risk Register with mitigations.
 */

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  { name: 'Executive Vision & Objectives', regex: /##\s*1\.\s*Executive Vision/i },
  { name: 'Milestone Roadmap & WBS', regex: /##\s*2\.\s*Milestone Roadmap/i },
  { name: 'Task Breakdown Structure', regex: /##\s*3\.\s*Task Breakdown/i },
  { name: 'Risk Register & Mitigation Strategy', regex: /##\s*4\.\s*Risk Register/i },
];

function validatePlan(filePath) {
  if (!filePath) {
    console.error('❌ Error: Please specify a project plan file.\nUsage: node validate-plan.mjs <path-to-project-plan.md>');
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Error: File not found at "${resolved}"`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const errors = [];
  const warnings = [];

  for (const sec of REQUIRED_SECTIONS) {
    if (!sec.regex.test(content)) {
      errors.push(`Missing mandatory section: "${sec.name}"`);
    }
  }

  const milestoneMatches = content.match(/\bM\d\b/g) || [];
  if (milestoneMatches.length === 0) {
    errors.push('No milestones (e.g. M1, M2) identified in roadmap.');
  }

  const riskMatches = content.match(/RSK-\d{3}/g) || [];
  if (riskMatches.length === 0) {
    warnings.push('No numbered risk IDs (RSK-001) found in Risk Register.');
  }

  console.log('\n========================================');
  console.log(`📅 Project Plan Validation: ${path.basename(resolved)}`);
  console.log('========================================');
  console.log(`Milestones Detected: ${[...new Set(milestoneMatches)].join(', ')}`);
  console.log(`Risks Cataloged: ${riskMatches.length}`);

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Plan Deficiencies:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease address issues above before proceeding to Phase 2 (Requirements).\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Project Plan satisfies Phase 1 planning standards!');
    console.log('   Ready for Phase 2: `sfa-prd-generator-validator`.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
validatePlan(target);
