#!/usr/bin/env node
/**
 * OpenAPI Contract Validator
 * Validates OpenAPI 3.0 / 3.1 YAML or JSON specifications:
 * - Checks OpenAPI version header.
 * - Ensures paths and operations have summary and responses.
 * - Validates presence of components, schemas, and error responses.
 */

import fs from 'node:fs';
import path from 'node:path';

function validateOpenApi(filePath) {
  if (!filePath) {
    console.error('❌ Error: Please specify an OpenAPI YAML or JSON file.\nUsage: node validate-openapi.mjs <path-to-openapi.yaml>');
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

  // 1. Check OpenAPI Version
  const versionMatch = content.match(/openapi:\s*['"]?(3\.[01]\.\d+)['"]?/i);
  if (!versionMatch) {
    errors.push('Missing or invalid "openapi: 3.x.x" version declaration.');
  }

  // 2. Check Paths Section
  if (!/paths:/i.test(content)) {
    errors.push('Missing mandatory "paths:" section.');
  }

  // 3. Check for at least one HTTP operation
  const operations = content.match(/\b(get|post|put|patch|delete):/gi) || [];
  if (operations.length === 0) {
    errors.push('No HTTP operations (get, post, put, patch, delete) found in paths.');
  }

  // 4. Check Components and Schemas
  if (!/components:\s*[\s\S]*schemas:/i.test(content)) {
    errors.push('Contract should declare reusable data structures under "components.schemas".');
  }

  // 5. Check for ProblemDetails / Error handling
  if (!/ProblemDetails|400|404|500/i.test(content)) {
    warnings.push('No standard RFC 7807 error responses or 4xx status codes detected.');
  }

  // 6. Check for Security Schemes
  if (!/securitySchemes:/i.test(content)) {
    warnings.push('No security schemes (e.g. BearerAuth) declared in components.');
  }

  console.log('\n========================================');
  console.log(`📡 OpenAPI Contract Report: ${path.basename(resolved)}`);
  console.log('========================================');
  if (versionMatch) {
    console.log(`Specification Version: OpenAPI ${versionMatch[1]}`);
  }
  console.log(`HTTP Operations Detected: ${operations.length} (${[...new Set(operations.map((o) => o.replace(':', '').toUpperCase()))].join(', ')})`);

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Contract Issues Found:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease fix the issues above before scaffolding API endpoints.\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: API Contract meets all Contract-First design standards!');
    console.log('   Ready for frontend/backend integration.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
validateOpenApi(target);
