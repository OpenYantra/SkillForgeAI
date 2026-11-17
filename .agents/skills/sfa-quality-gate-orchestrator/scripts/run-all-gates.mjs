#!/usr/bin/env node
/**
 * Quality Gate Orchestrator Runner
 * Orchestrates quality verification across all 7 SDLC phases.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const GATES = [
  {
    phase: 1,
    name: 'Phase 1: Planning & Feasibility',
    script: '.agents/skills/sfa-project-planner-estimator/scripts/validate-plan.mjs',
    target: '.agents/skills/sfa-project-planner-estimator/templates/project-plan-template.md',
  },
  {
    phase: 2,
    name: 'Phase 2: Requirements Analysis (PRD)',
    script: '.agents/skills/sfa-prd-generator-validator/scripts/validate-prd.mjs',
    target: 'examples/order-service/order-service.prd.md',
  },
  {
    phase: 2,
    name: 'Phase 2/3: API Contract (OpenAPI)',
    script: '.agents/skills/sfa-api-contract-designer/scripts/validate-openapi.mjs',
    target: '.agents/skills/sfa-api-contract-designer/templates/openapi-template.yaml',
  },
  {
    phase: 3,
    name: 'Phase 3: Architecture & ADRs',
    script: '.agents/skills/sfa-system-architecture-adr/scripts/validate-architecture.mjs',
    target: '.agents/skills/sfa-system-architecture-adr/templates/architecture-spec-template.md',
  },
  {
    phase: 3,
    name: 'Phase 3 -> 4: Human-in-the-Loop (HITL) Sign-Off Gate',
    script: 'scripts/verify-human-signoff.mjs',
    target: 'examples/order-service/docs/approvals/order-service-signoff.md',
  },
  {
    phase: 4,
    name: 'Phase 4: Code Scaffolding Boundaries',
    script: '.agents/skills/sfa-feature-scaffolder/scripts/verify-scaffold.mjs',
    target: 'examples/order-service/src',
  },
  {
    phase: 5,
    name: 'Phase 5: Test Criteria & AAA Structure',
    script: '.agents/skills/sfa-unit-test-synthesizer/scripts/verify-coverage-criteria.mjs',
    target: 'examples/order-service/tests/order.service.spec.ts',
  },
  {
    phase: 6,
    name: 'Phase 6: Container Hardening & CI/CD',
    script: '.agents/skills/sfa-cicd-container-automator/scripts/validate-ci-container.mjs',
    target: '.agents/skills/sfa-cicd-container-automator/templates/Dockerfile.template',
  },
  {
    phase: 6,
    name: 'Phase 6: Security Weakness & Vulnerability Audit',
    script: '.agents/skills/sfa-security-vulnerability-auditor/scripts/audit-security.mjs',
    target: 'examples/order-service/src',
  },
  {
    phase: 7,
    name: 'Phase 7: Maintenance & Incident RCA',
    script: '.agents/skills/sfa-incident-root-cause-analyzer/scripts/validate-rca.mjs',
    target: '.agents/skills/sfa-incident-root-cause-analyzer/templates/rca-report-template.md',
  },
];

function runGates(selectedPhase = null) {
  console.log('\n======================================================');
  console.log('🛡️  SkillForgeAI: Unified SDLC Quality Gate Evaluation');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;
  const results = [];

  const activeGates = selectedPhase
    ? GATES.filter((g) => g.phase === Number(selectedPhase))
    : GATES;

  if (activeGates.length === 0) {
    console.error(`❌ No quality gates found for phase: ${selectedPhase}`);
    process.exit(1);
  }

  for (const gate of activeGates) {
    process.stdout.write(`Evaluating [${gate.name}]... `);
    try {
      execSync(`node ${gate.script} ${gate.target}`, { stdio: 'pipe' });
      console.log('✅ PASSED');
      results.push({ name: gate.name, status: 'PASSED' });
      passed++;
    } catch (err) {
      console.log('❌ FAILED');
      results.push({ name: gate.name, status: 'FAILED' });
      failed++;
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`Summary: ${passed} Passed, ${failed} Failed out of ${activeGates.length} Total Gates`);
  console.log('------------------------------------------------------');

  if (failed > 0) {
    console.log('\n⚠️  One or more SDLC quality gates failed. Check logs above.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SDLC QUALITY GATES PASSED! Project is ready for production.\n');
    process.exit(0);
  }
}

const phaseArgIndex = process.argv.indexOf('--phase');
const phaseFilter = phaseArgIndex !== -1 ? process.argv[phaseArgIndex + 1] : null;

runGates(phaseFilter);
