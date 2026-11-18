/**
 * Clean Architecture scaffold boundary validator (Phase 4).
 */

import fs from 'node:fs';
import path from 'node:path';
import { emptyResult, finalize, requireDirectory } from './common.mjs';
import { extractImportSources } from '../parsers/symbols.mjs';

export const FORBIDDEN_DOMAIN_IMPORTS = [
  // TypeScript / Node
  'express',
  'fastify',
  'koa',
  '@nestjs',
  'prisma',
  '@prisma/client',
  'typeorm',
  'mongoose',
  'pg',
  'mysql2',
  'axios',
  // C# / .NET
  'Microsoft.EntityFrameworkCore',
  'Microsoft.AspNetCore',
  'System.Data',
  'Dapper',
  'System.Net.Http',
  // Python
  'fastapi',
  'flask',
  'django.db',
  'sqlalchemy',
  'httpx',
  'requests',
  // Go
  'net/http',
  'gorm.io',
  'database/sql',
  'github.com/gin-gonic',
  // Java / Kotlin
  'org.springframework',
  'jakarta.persistence',
  'javax.persistence',
  'org.hibernate',
  'java.sql',
  'io.ktor',
];

function scanSourceFiles(dir, fileList = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/^(bin|obj|node_modules|\.git)$/.test(entry.name)) scanSourceFiles(fullPath, fileList);
    } else if (/\.(ts|js|mjs|cs|py|go|java|kt)$/i.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function matchesForbidden(source, forbidden) {
  if (source === forbidden) return true;
  if (source.startsWith(`${forbidden}/`)) return true;
  return forbidden.includes('.') && source.startsWith(`${forbidden}.`);
}

/**
 * @param {string} target feature directory
 */
export function verifyScaffold(target) {
  const result = emptyResult();
  if (!requireDirectory(target, result)) return finalize(result);

  const resolvedDir = path.resolve(target);
  const files = scanSourceFiles(resolvedDir);

  if (files.length === 0) {
    result.errors.push('No source files (.ts, .js, .mjs, .cs, .py, .go) found in directory.');
    return finalize(result);
  }

  for (const file of files) {
    const relativePath = path.relative(resolvedDir, file).replace(/\\/g, '/');

    if (/(^|[\\/])domain[\\/]/i.test(file.replace(/\\/g, '/'))) {
      const { sources } = extractImportSources(file);
      for (const source of sources) {
        for (const forbidden of FORBIDDEN_DOMAIN_IMPORTS) {
          if (matchesForbidden(source, forbidden)) {
            result.errors.push(
              `Clean Architecture Violation in ${relativePath}: Domain layer must not import infrastructure package "${forbidden}".`,
            );
          }
        }
      }
    }

    if (/\.(ts|js|mjs)$/i.test(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      if (/throw\s+new\s+Error\s*\(/.test(content)) {
        result.warnings.push(
          `Generic error throw detected in ${relativePath}. Prefer typed domain errors (e.g., DomainValidationError).`,
        );
      }
    }
  }

  result.details = { filesScanned: files.length };
  return finalize(result);
}
