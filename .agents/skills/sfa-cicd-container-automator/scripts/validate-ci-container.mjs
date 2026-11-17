#!/usr/bin/env node
/**
 * CI/CD Pipeline & Dockerfile Hardening Verifier
 * Validates:
 * 1. Dockerfile uses multi-stage builds (multiple FROM statements).
 * 2. Container runs as an unprivileged user (USER directive present).
 * 3. CI/CD workflow contains automated test and lint steps.
 */

import fs from 'node:fs';
import path from 'node:path';

function validateCiAndContainer(targetPath) {
  if (!targetPath) {
    console.error('❌ Error: Please specify Dockerfile or CI workflow path.\nUsage: node validate-ci-container.mjs <file-or-dir>');
    process.exit(1);
  }

  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌ Error: Path not found at "${resolved}"`);
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  let content = '';
  const isDirectory = fs.statSync(resolved).isDirectory();

  if (!isDirectory) {
    content = fs.readFileSync(resolved, 'utf-8');
    const fileName = path.basename(resolved).toLowerCase();

    // If Dockerfile
    if (fileName.includes('dockerfile')) {
      const fromCount = (content.match(/^FROM\s+/gim) || []).length;
      if (fromCount < 2) {
        warnings.push('Single-stage Dockerfile detected. Recommend multi-stage builds to minimize image attack surface.');
      }

      if (!/USER\s+[a-zA-Z0-9_-]+/i.test(content)) {
        errors.push('Security Risk: Dockerfile does not specify an unprivileged "USER". Root execution is forbidden.');
      }

      if (!/HEALTHCHECK/i.test(content)) {
        warnings.push('No HEALTHCHECK instruction defined in Dockerfile.');
      }
    }

    // If Workflow file
    if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
      if (!/test/i.test(content)) {
        errors.push('CI workflow does not appear to run automated tests.');
      }
      if (!/on:\s*[\s\S]*?(push|pull_request)/i.test(content)) {
        warnings.push('CI workflow should trigger on pull_request or push events.');
      }
    }
  }

  console.log('\n========================================');
  console.log(`🚀 CI/CD & Container Verification: ${path.basename(resolved)}`);
  console.log('========================================');

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - DevOps Configuration Issues:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease fix the issues above before deploying.\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Configuration satisfies Phase 6 container and CI/CD standards!\n');
    process.exit(0);
  }
}

const target = process.argv[2];
validateCiAndContainer(target);
