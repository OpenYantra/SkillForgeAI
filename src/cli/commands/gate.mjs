/**
 * SkillForge CLI: Gate Command
 * Evaluates SDLC quality gates against configured project artifacts using the
 * shared in-process gate runner.
 */

import path from 'node:path';
import fs from 'node:fs';
import { printBanner, printSuccess, printError, colors } from '../ui.mjs';
import { loadGateConfig, isSelfTest } from '../../core/gate-registry.mjs';
import { runGates } from '../../core/gate-runner.mjs';

export async function executeGate(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge gate [options]

Options:
  --phase <1-7>     Evaluate quality gates for a specific SDLC phase
  --config <file>   Path to the project gate config (default: skillforge.config.json)
  --self-test       Force framework self-test targets (ignore project artifacts)
  --allow-missing   Treat unconfigured/missing artifacts as SKIPPED instead of FAILED
  --strict          Fail on warnings as well as validation errors
  --json            Emit machine-readable JSON results (for CI/CD PR bots)
  --out <file>      Write JSON results directly to a file
  --help, -h        Show this help message

Behavior:
  In "project" mode every gate validates the artifact mapped to it in
  skillforge.config.json. A missing required artifact fails the gate (fail closed).
  In "self-test" mode (set via config or explicitly passing --self-test) the
  framework's own example/template artifacts are validated. When no config exists,
  gate fails closed unless --self-test is passed explicitly.

Examples:
  skillforge gate
  skillforge gate --phase 4
  skillforge gate --config skillforge.config.json
  skillforge gate --self-test
  skillforge gate --json
  skillforge gate --out gate-report.json
`);
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const isStrict = args.includes('--strict');
  const allowMissing = args.includes('--allow-missing');
  const forceSelfTest = args.includes('--self-test');

  const phaseIndex = args.indexOf('--phase');
  const selectedPhase = phaseIndex !== -1 ? Number(args[phaseIndex + 1]) : null;
  const outIndex = args.indexOf('--out');
  const outFile = outIndex !== -1 ? args[outIndex + 1] : null;
  const configIndex = args.indexOf('--config');
  const configPath = configIndex !== -1 ? args[configIndex + 1] : undefined;

  if (selectedPhase !== null && (isNaN(selectedPhase) || selectedPhase < 1 || selectedPhase > 7)) {
    if (isJson) {
      console.log(JSON.stringify({ error: `Invalid phase "${args[phaseIndex + 1]}". Must be 1 to 7.` }));
    } else {
      printError(`Invalid phase "${args[phaseIndex + 1]}". Must be between 1 and 7.`);
    }
    process.exit(2);
  }

  let config;
  try {
    config = loadGateConfig(configPath);
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    } else {
      printError(`Failed to load gate config: ${err.message}`);
    }
    process.exit(2);
  }

  const selfTest = isSelfTest(config, { selfTest: forceSelfTest });

  if (!isJson) {
    printBanner(
      '🛡️  SkillForgeAI: Unified SDLC Quality Gate Evaluation',
      `${selectedPhase ? `Evaluating Phase ${selectedPhase} Gates` : 'Evaluating All 7 SDLC Phases'} · mode: ${selfTest ? 'self-test' : 'project'}`,
    );
    if (selfTest && config.source === 'default') {
      console.log(
        `${colors.yellow}⚠️  No skillforge.config.json found — refusing to certify a project with self-test targets. Use --self-test to validate framework templates explicitly.${colors.reset}\n`,
      );
    }
  }

  let summary;
  try {
    const result = await runGates({
      config,
      phase: selectedPhase,
      selfTest: forceSelfTest ? true : undefined,
      allowMissing,
      strict: isStrict,
    });
    summary = result.summary;
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'FAILED', error: err.message }));
    } else {
      printError(err.message);
    }
    process.exit(1);
  }

  if (!isJson) {
    for (const gate of summary.gates) {
      if (gate.status === 'PASSED') {
        console.log(`Evaluating [${gate.name}]... ${colors.green}✔ PASSED${colors.reset}`);
      } else if (gate.status === 'SKIPPED' && gate.required) {
        console.log(`Evaluating [${gate.name}]... ${colors.red}✖ FAILED (required gate skipped)${colors.reset}`);
      } else if (gate.status === 'SKIPPED') {
        console.log(`Evaluating [${gate.name}]... ${colors.yellow}⏭ SKIPPED (artifact not configured)${colors.reset}`);
      } else if (gate.reason === 'Strict mode warning detected') {
        console.log(`Evaluating [${gate.name}]... ${colors.red}✖ FAILED (Strict Warning)${colors.reset}`);
      } else if (gate.reason && gate.reason.startsWith('Required artifact')) {
        console.log(`Evaluating [${gate.name}]... ${colors.red}✖ FAILED (missing artifact)${colors.reset}`);
      } else if (gate.reason && /Unresolved required artifact|outside the allowed roots/.test(gate.reason)) {
        console.log(`Evaluating [${gate.name}]... ${colors.red}✖ FAILED (invalid artifact mapping)${colors.reset}`);
      } else {
        console.log(`Evaluating [${gate.name}]... ${colors.red}✖ FAILED${colors.reset}`);
      }
      if (gate.status === 'FAILED' && gate.error) console.log(`   ${colors.dim}${gate.error}${colors.reset}`);
    }
  }

  if (isJson || outFile) {
    const jsonStr = JSON.stringify(summary, null, 2);
    if (outFile) {
      const dir = path.dirname(outFile);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outFile, jsonStr);
    }
    if (isJson || !outFile) {
      console.log(jsonStr);
    }
    process.exit(summary.status === 'PASSED' ? 0 : 1);
  }

  console.log(`\n${colors.dim}${'─'.repeat(60)}${colors.reset}`);
  console.log(
    `Summary: ${summary.passed} Passed, ${summary.failed} Failed, ${summary.skipped} Skipped` +
      (summary.skippedRequired ? ` (${summary.skippedRequired} required)` : '') +
      ` out of ${summary.totalGates} Total Gates`,
  );
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);

  if (summary.status !== 'PASSED') {
    printError('One or more SDLC quality gates failed. Please check the logs above.');
    process.exit(1);
  } else {
    printSuccess('ALL SDLC QUALITY GATES PASSED! Project is ready for production.\n');
    process.exit(0);
  }
}
