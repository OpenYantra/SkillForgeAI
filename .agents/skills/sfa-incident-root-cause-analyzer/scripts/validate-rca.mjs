#!/usr/bin/env node
/**
 * Root Cause Analysis (RCA) Validator
 * Ensures that post-incident reports contain:
 * - Executive summary with duration & blast radius
 * - Chronological incident timeline
 * - 5-Whys root cause breakdown
 * - Actionable remediation items
 */

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  { name: 'Executive Summary & Impact', regex: /##\s*1\.\s*Executive Summary/i },
  { name: 'Incident Timeline', regex: /##\s*2\.\s*Incident Timeline/i },
  { name: 'Root Cause Analysis (5-Whys)', regex: /##\s*3\.\s*Root Cause/i },
  { name: 'Remediation & Regression Prevention', regex: /##\s*4\.\s*Remediation/i },
];

function validateRca(filePath) {
  if (!filePath) {
    console.error('❌ Error: Please specify an RCA report file.\nUsage: node validate-rca.mjs <path-to-rca.md>');
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

  const incidentMatch = content.match(/INC-\d+/i);
  if (!incidentMatch) {
    warnings.push('No incident ID (e.g. INC-101) identified in report.');
  }

  const actionItems = content.match(/ACT-\d{3}/g) || [];
  if (actionItems.length === 0) {
    errors.push('No actionable remediation items (ACT-001) found in post-mortem.');
  }

  console.log('\n========================================');
  console.log(`🔍 Incident RCA Validation: ${path.basename(resolved)}`);
  console.log('========================================');
  console.log(`Action Items Recorded: ${actionItems.length}`);

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - RCA Deficiencies Found:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease complete the missing sections before closing this incident.\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Post-mortem satisfies Phase 7 RCA standards!');
    console.log('   Ready for archival and action-item tracking.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
validateRca(target);
