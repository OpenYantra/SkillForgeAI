#!/usr/bin/env node
/**
 * Polyglot Scaffold Structure & Architecture Boundary Verifier
 * Checks whether a feature directory adheres to clean architecture principles:
 * - Domain layer must not import infrastructure or web frameworks (TS, C#, Python, Go).
 * - Layer separation (domain, services, repositories/controllers) is respected.
 */

import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_DOMAIN_IMPORTS = [
  // TypeScript / Node
  'express', 'fastify', 'koa', '@nestjs', 'prisma', '@prisma/client', 'typeorm', 'mongoose', 'pg', 'mysql2', 'axios',
  // C# / .NET
  'Microsoft.EntityFrameworkCore', 'Microsoft.AspNetCore', 'System.Data', 'Dapper', 'System.Net.Http',
  // Python
  'fastapi', 'flask', 'django.db', 'sqlalchemy', 'httpx', 'requests',
  // Go
  'net/http', 'gorm.io', 'database/sql', 'github.com/gin-gonic',
];

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!/bin|obj|node_modules|\.git/.test(file)) {
        scanDirectory(fullPath, fileList);
      }
    } else if (/\.(ts|js|mjs|cs|py|go)$/i.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyScaffold(targetDir) {
  if (!targetDir) {
    console.error('❌ Error: Please specify target feature directory.\nUsage: node verify-scaffold.mjs <path-to-feature-dir>');
    process.exit(1);
  }

  const resolvedDir = path.resolve(targetDir);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`❌ Error: Directory not found at "${resolvedDir}"`);
    process.exit(1);
  }

  const files = scanDirectory(resolvedDir);
  const errors = [];
  const warnings = [];

  if (files.length === 0) {
    errors.push('No source files (.ts, .js, .mjs, .cs, .py, .go) found in directory.');
  }

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(resolvedDir, file);

    // Rule: Domain layer must be pure and free of infrastructure/HTTP framework imports
    if (/[\\/]domain[\\/]/i.test(file)) {
      for (const forbidden of FORBIDDEN_DOMAIN_IMPORTS) {
        // Checks imports/usings: from 'x', using x;, import x
        const importRegex = new RegExp(`(?:from\\s+['"]${forbidden}['"]|require\\(['"]${forbidden}['"]\\)|using\\s+${forbidden}|import\\s+['"]?${forbidden}['"]?)`, 'i');
        if (importRegex.test(content)) {
          errors.push(`Clean Architecture Violation in ${relativePath}: Domain layer must not import infrastructure package "${forbidden}".`);
        }
      }
    }

    // Rule: Check for unhandled generic error throws in TS/JS
    if (/\.(ts|js|mjs)$/i.test(file)) {
      const genericThrow = /throw\s+new\s+Error\s*\(/g;
      if (genericThrow.test(content)) {
        warnings.push(`Generic error throw detected in ${relativePath}. Prefer typed domain errors (e.g., DomainValidationError).`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`🏗️  Polyglot Feature Scaffold Verification: ${path.basename(resolvedDir)}`);
  console.log('========================================');
  console.log(`Scanned ${files.length} source file(s).`);

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Architecture Violations Found:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease fix the violations above before proceeding to Phase 5 (Unit Testing).\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Feature structure conforms to clean architectural boundary standards.');
    console.log('   Ready for Phase 5: `unit-test-synthesizer`.\n');
    process.exit(0);
  }
}

const target = process.argv[2];
verifyScaffold(target);
