#!/usr/bin/env node
/**
 * SkillForgeAI: Human-in-the-Loop (HITL) Sign-Off Gate
 * Ensures that AI coding agents cannot scaffold features or deploy to production
 * without explicit, documented human approval in docs/approvals/.
 */

import fs from 'node:fs';
import path from 'node:path';

function verifySignOff(signOffPath) {
  if (!signOffPath) {
    console.error('❌ Error: Please specify a sign-off document path.\nUsage: node verify-human-signoff.mjs <path-to-sign-off.md>');
    process.exit(1);
  }

  const resolved = path.resolve(signOffPath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Error: Sign-off file not found at "${resolved}"`);
    console.log('💡 To create one, copy templates/phase-signoff-template.md to docs/approvals/\n');
    process.exit(1);
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const errors = [];
  const warnings = [];

  // 1. Check Approval Status (handles bold/non-bold)
  const statusMatch = content.match(/\*{0,2}Status:\*{0,2}\s*([^\n\r]+)/i);
  const statusText = statusMatch ? statusMatch[1].trim() : '';
  if (!/\bAPPROVED\b/i.test(statusText)) {
    errors.push(`Human sign-off status is not APPROVED (found "${statusText || 'None'}").`);
  }

  // 2. Check Reviewer Identity
  const reviewerMatch = content.match(/\*{0,2}Reviewed By \(Human\):\*{0,2}\s*([^\n\r]+)/i);
  const reviewerText = reviewerMatch ? reviewerMatch[1].replace(/^\*+|\*+$/g, '').trim() : '';
  if (!reviewerText || reviewerText.includes('[') || reviewerText.length === 0) {
    errors.push('Reviewed By (Human) is missing or contains placeholder text. A verified human name is required.');
  }

  // 3. Check Approval Date
  const dateMatch = content.match(/\*{0,2}Approval Date:\*{0,2}\s*(\d{4}-\d{2}-\d{2})/i);
  if (!dateMatch) {
    warnings.push('Approval date is missing or not in YYYY-MM-DD format.');
  }

  // 4. Check Authorization Checkbox
  const hasAuthorization = /\[x\]\s*Authorized to proceed/i.test(content);
  if (!hasAuthorization) {
    errors.push('Missing explicit authorization checkbox: "[x] Authorized to proceed".');
  }

  console.log('\n======================================================');
  console.log(`👤 SkillForgeAI: Human-in-the-Loop (HITL) Governance Gate`);
  console.log('======================================================\n');
  console.log(`Evaluating Sign-off Document: ${path.basename(resolved)}`);
  if (reviewerText) console.log(`Reviewer: ${reviewerText}`);
  if (dateMatch) console.log(`Date: ${dateMatch[1]}`);

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Human Sign-Off Missing or Incomplete:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\n🛑 Agent Execution Halted: AI coding agents must not proceed to implementation without human approval.\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Human-in-the-Loop sign-off verified!');
    console.log('   AI Coding Agent is authorized to proceed to next phase.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
verifySignOff(target);
