#!/usr/bin/env node
/**
 * Test Suite Criteria & Sanity Verifier (Polyglot: TS, C#, Python, Go)
 * Validates that generated unit test files:
 * 1. Exist and have valid naming conventions (*.spec.*, *Tests.cs, test_*.py, *_test.go).
 * 2. Contain explicit assertions (expect, assert, Assert.*).
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
      if (!/bin|obj|node_modules|\.git/.test(file)) {
        scanTestFiles(fullPath, list);
      }
    } else if (
      /\.(spec|test)\.(ts|js|mjs)$/i.test(file) ||
      /Tests?\.cs$/i.test(file) ||
      /(^test_.*|.*_test)\.py$/i.test(file) ||
      /.*_test\.go$/i.test(file)
    ) {
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
    errors.push('No test files (*.spec.*, *Tests.cs, test_*.py, *_test.go) found.');
  }

  let totalTestsCount = 0;
  let totalAssertionsCount = 0;
  let requirementsCited = 0;

  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.basename(file);

    // Count test cases (JS: it/test, C#: [Fact]/[Theory], Py: def test_, Go: func Test)
    const testCases = content.match(/\b(it|test)\s*\(|\[Fact\]|\[Theory\]|\bdef\s+test_\w+|\bfunc\s+Test\w+/gi) || [];
    totalTestsCount += testCases.length;

    if (testCases.length === 0) {
      warnings.push(`File "${relativePath}" does not contain recognized test case declarations.`);
    }

    // Count assertions (expect, assert, Assert.*)
    const assertions = content.match(/\b(expect|assert|Assert\.\w+)\b/gi) || [];
    totalAssertionsCount += assertions.length;

    if (assertions.length === 0) {
      errors.push(`File "${relativePath}" has 0 assertions! Tests must assert outcomes.`);
    }

    // Check FR / EC references (FR-001, EC-001, FR001, EC001)
    const reqMatches = content.match(/(?:^|[^a-zA-Z0-9])(FR-?\d{3}|EC-?\d{3})(?:$|[^a-zA-Z0-9])/gi) || [];
    requirementsCited += reqMatches.length;
    if (reqMatches.length === 0) {
      warnings.push(`File "${relativePath}" does not cite any requirement IDs (e.g. FR-001, EC-001).`);
    }
  }

  console.log('\n========================================');
  console.log(`🧪 Polyglot Test Suite Verification Report`);
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
    console.log('\nPlease fix the issues above to complete the SDLC test gate.\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Test suite satisfies SDLC Phase 5 quality standards!');
    console.log('   Testing phase verified successfully.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
verifyTestCriteria(target);
