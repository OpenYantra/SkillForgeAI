#!/usr/bin/env node
/**
 * Test Suite Criteria & Sanity Verifier
 * Validates that generated unit test files:
 * 1. Exist and have valid naming conventions (*.spec.*, *.test.*).
 * 2. Contain explicit assertions (expect, assert).
 * 3. Reference functional requirements or edge cases (FR-XXX / EC-XXX).
 * 4. Are not empty or trivial.
 */

import fs from 'node:fs';
import path from 'node:path';

function scanTestFiles(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanTestFiles(fullPath, list);
    } else if (/\.(spec|test)\.(ts|js|mjs)$/i.test(file)) {
      list.push(fullPath);
    }
  }
  return list;
}

function verifyTestCriteria(targetPath) {
  if (!targetPath) {
    console.error('❌ Error: Please specify a test file or directory.\nUsage: node verify-coverage-criteria.mjs <path-to-test-dir-or-file>');
    process.exit(1);
  }

  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Error: Target not found at "${resolved}"`);
    process.exit(1);
  }

  const testFiles = fs.statSync(resolved).isDirectory()
    ? scanTestFiles(resolved)
    : [resolved];

  const errors = [];
  const warnings = [];

  if (testFiles.length === 0) {
    errors.push('No test files (*.spec.* or *.test.*) found.');
  }

  let totalTestsCount = 0;
  let totalAssertionsCount = 0;
  let requirementsCited = 0;

  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.basename(file);

    // Count test cases
    const testCases = content.match(/\b(it|test)\s*\(/g) || [];
    totalTestsCount += testCases.length;

    if (testCases.length === 0) {
      warnings.push(`File "${relativePath}" does not contain any test cases [it() or test()].`);
    }

    // Count assertions
    const assertions = content.match(/\b(expect|assert)\b/g) || [];
    totalAssertionsCount += assertions.length;

    if (assertions.length === 0) {
      errors.push(`File "${relativePath}" has 0 assertions! Tests must assert outcomes.`);
    }

    // Check FR / EC references
    const reqMatches = content.match(/\b(FR-\d{3}|EC-\d{3})\b/g) || [];
    requirementsCited += reqMatches.length;
    if (reqMatches.length === 0) {
      warnings.push(`File "${relativePath}" does not cite any requirement IDs (e.g. FR-001, EC-001).`);
    }
  }

  console.log('\n========================================');
  console.log(`🧪 Test Suite Verification Report`);
  console.log('========================================');
  console.log(`Evaluated ${testFiles.length} test file(s).`);
  console.log(`Total test cases detected: ${totalTestsCount}`);
  console.log(`Total assertions detected: ${totalAssertionsCount}`);
  console.log(`Requirements / Edge cases cited: ${requirementsCited}`);

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Test Quality Deficiencies Found:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease fix the issues above to complete the Wave 1 loop.\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Test suite satisfies Wave 1 quality standards!');
    console.log('   Core coding loop completed successfully.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
verifyTestCriteria(target);
