#!/usr/bin/env node
/**
 * Architecture Specification & ADR Verifier
 * Validates that an architecture document adheres to Phase 3 SDLC requirements:
 * - Contains C4 context and container diagrams (Mermaid format).
 * - Documents architectural boundaries and security design.
 * - Indexes or references Architecture Decision Records (ADRs).
 */

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_SECTIONS = [
  { name: 'Architectural Drivers & Goals', regex: /##\s*1\.\s*Architectural Drivers/i },
  { name: 'System Context (C4 Level 1)', regex: /##\s*2\.\s*System Context/i },
  { name: 'Container & Component Architecture (C4 Level 2)', regex: /##\s*3\.\s*Container & Component/i },
  { name: 'Architectural Boundaries & Data Flow', regex: /##\s*4\.\s*Architectural Boundaries/i },
  { name: 'Security & Network Architecture', regex: /##\s*5\.\s*Security/i },
  { name: 'Index of ADRs', regex: /##\s*6\.\s*Index of Architecture Decision Records/i },
];

function validateArchitecture(filePath) {
  if (!filePath) {
    console.error('❌ Error: Please specify an architecture file path.\nUsage: node validate-architecture.mjs <path-to-architecture.md>');
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

  // 2. Check for Mermaid diagrams
  const mermaidBlocks = content.match(/```mermaid[\s\S]*?```/g) || [];
  if (mermaidBlocks.length < 2) {
    errors.push(`Expected at least 2 Mermaid diagrams (C4 Context and C4 Container), found ${mermaidBlocks.length}.`);
  }

  // 3. Check for ADR references
  const adrMatches = content.match(/ADR-\d{4}/g) || [];
  if (adrMatches.length === 0) {
    warnings.push('No ADR references (e.g., ADR-0001) found. Architectural decisions should be recorded.');
  }

  console.log('\n========================================');
  console.log(`🏛️  Architecture Specification Report: ${path.basename(resolvedPath)}`);
  console.log('========================================');

  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach((w) => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ FAILED - Architectural Deficiencies Found:');
    errors.forEach((e) => console.log(`   - ${e}`));
    console.log('\nPlease fix the issues above before proceeding to Phase 4 (Scaffolding).\n');
    process.exit(1);
  } else {
    console.log('\n✅ PASSED: Architecture document satisfies Phase 3 design standards!');
    console.log(`   Mermaid Diagrams Detected: ${mermaidBlocks.length}`);
    console.log(`   ADRs Indexed: ${[...new Set(adrMatches)].join(', ') || 'None'}`);
    console.log('   Ready for Contract Design & Scaffolding.\n');
    process.exit(0);
  }
}

const targetFile = process.argv[2];
validateArchitecture(targetFile);
