/**
 * SkillForge CLI: Gate Command
 * Evaluates SDLC quality gates across phases.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { printBanner, printSuccess, printError, printWarning, colors, icons } from '../ui.mjs';

const GATES = [
  {
    phase: 1,
    name: 'Phase 1: Planning & Feasibility',
    script: '.agents/skills/project-planner-estimator/scripts/validate-plan.mjs',
    target: '.agents/skills/project-planner-estimator/templates/project-plan-template.md',
  },
  {
    phase: 2,
    name: 'Phase 2: Requirements Analysis (PRD)',
    script: '.agents/skills/prd-generator-validator/scripts/validate-prd.mjs',
    target: 'examples/order-service/order-service.prd.md',
  },
  {
    phase: 2,
    name: 'Phase 2/3: API Contract (OpenAPI)',
    script: '.agents/skills/api-contract-designer/scripts/validate-openapi.mjs',
    target: '.agents/skills/api-contract-designer/templates/openapi-template.yaml',
  },
  {
    phase: 3,
    name: 'Phase 3: Architecture & ADRs',
    script: '.agents/skills/system-architecture-adr/scripts/validate-architecture.mjs',
    target: '.agents/skills/system-architecture-adr/templates/architecture-spec-template.md',
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
    script: '.agents/skills/feature-scaffolder/scripts/verify-scaffold.mjs',
    target: 'examples/order-service/src',
  },
  {
    phase: 5,
    name: 'Phase 5: Test Criteria & AAA Structure',
    script: '.agents/skills/unit-test-synthesizer/scripts/verify-coverage-criteria.mjs',
    target: 'examples/order-service/tests/order.service.spec.ts',
  },
  {
    phase: 6,
    name: 'Phase 6: Container Hardening & CI/CD',
    script: '.agents/skills/cicd-container-automator/scripts/validate-ci-container.mjs',
    target: '.agents/skills/cicd-container-automator/templates/Dockerfile.template',
  },
  {
    phase: 7,
    name: 'Phase 7: Maintenance & Incident RCA',
    script: '.agents/skills/incident-root-cause-analyzer/scripts/validate-rca.mjs',
    target: '.agents/skills/incident-root-cause-analyzer/templates/rca-report-template.md',
  },
];

export function executeGate(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge gate [options]

Options:
  --phase <1-7>     Evaluate quality gates for a specific SDLC phase
  --strict          Fail on warnings as well as validation errors
  --json            Emit machine-readable JSON results (for CI/CD PR bots)
  --out <file>      Write JSON results directly to a file
  --help, -h        Show this help message

Examples:
  skillforge gate
  skillforge gate --phase 4
  skillforge gate --json
  skillforge gate --out gate-report.json
`);
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const isStrict = args.includes('--strict');
  const phaseIndex = args.indexOf('--phase');
  const selectedPhase = phaseIndex !== -1 ? Number(args[phaseIndex + 1]) : null;
  const outIndex = args.indexOf('--out');
  const outFile = outIndex !== -1 ? args[outIndex + 1] : null;

  if (selectedPhase !== null && (isNaN(selectedPhase) || selectedPhase < 1 || selectedPhase > 7)) {
    if (isJson) {
      console.log(JSON.stringify({ error: `Invalid phase "${args[phaseIndex + 1]}". Must be 1 to 7.` }));
    } else {
      printError(`Invalid phase "${args[phaseIndex + 1]}". Must be between 1 and 7.`);
    }
    process.exit(2);
  }

  const activeGates = selectedPhase !== null
    ? GATES.filter((g) => g.phase === selectedPhase)
    : GATES;

  if (!isJson) {
    printBanner(
      '🛡️  SkillForgeAI: Unified SDLC Quality Gate Evaluation',
      selectedPhase ? `Evaluating Phase ${selectedPhase} Gates` : 'Evaluating All 7 SDLC Phases (9 Gates)'
    );
  }

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const gate of activeGates) {
    if (!isJson) {
      process.stdout.write(`Evaluating [${gate.name}]... `);
    }
    try {
      const output = execSync(`node ${gate.script} ${gate.target}`, { encoding: 'utf-8', stdio: 'pipe' });
      const hasWarning = /⚠️\s+WARNING/i.test(output);

      if (isStrict && hasWarning) {
        if (!isJson) console.log(`${colors.red}✖ FAILED (Strict Warning)${colors.reset}`);
        results.push({ name: gate.name, phase: gate.phase, status: 'FAILED', reason: 'Strict mode warning detected' });
        failed++;
      } else {
        if (!isJson) console.log(`${colors.green}✔ PASSED${colors.reset}`);
        results.push({ name: gate.name, phase: gate.phase, status: 'PASSED', warnings: hasWarning });
        passed++;
      }
    } catch (err) {
      if (!isJson) console.log(`${colors.red}✖ FAILED${colors.reset}`);
      results.push({ name: gate.name, phase: gate.phase, status: 'FAILED', error: err.message });
      failed++;
    }
  }

  if (isJson || outFile) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalGates: activeGates.length,
      passed,
      failed,
      status: failed === 0 ? 'PASSED' : 'FAILED',
      gates: results,
    };
    const jsonStr = JSON.stringify(summary, null, 2);
    if (outFile) {
      const dir = path.dirname(outFile);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outFile, jsonStr);
    }
    if (isJson || !outFile) {
      console.log(jsonStr);
    }
    process.exit(failed === 0 ? 0 : 1);
  }

  console.log(`\n${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  console.log(`Summary: ${passed} Passed, ${failed} Failed out of ${activeGates.length} Total Gates`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);

  if (failed > 0) {
    printError('One or more SDLC quality gates failed. Please check the logs above.');
    process.exit(1);
  } else {
    printSuccess('ALL SDLC QUALITY GATES PASSED! Project is ready for production.\n');
    process.exit(0);
  }
}
