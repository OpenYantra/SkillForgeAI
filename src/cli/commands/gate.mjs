/**
 * SkillForge CLI: Gate Command
 * Evaluates SDLC quality gates against configured project artifacts.
 */

import path from 'node:path';
import fs from 'node:fs';
import { printBanner, printSuccess, printError, colors } from '../ui.mjs';
import { GATE_REGISTRY, loadGateConfig, isSelfTest, resolveGateTargets } from '../../core/gate-registry.mjs';
import { runNode } from '../../core/exec.mjs';

export function executeGate(args = []) {
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
  In "self-test" mode (default when no config exists) the framework's own
  example/template artifacts are validated.

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

  const activeGates = selectedPhase !== null
    ? GATE_REGISTRY.filter((g) => g.phase === selectedPhase)
    : GATE_REGISTRY;

  if (!isJson) {
    printBanner(
      '🛡️  SkillForgeAI: Unified SDLC Quality Gate Evaluation',
      `${selectedPhase ? `Evaluating Phase ${selectedPhase} Gates` : `Evaluating All 7 SDLC Phases (${activeGates.length} Gates)`} · mode: ${selfTest ? 'self-test' : 'project'}`
    );
    if (selfTest && config.source === 'default') {
      console.log(`${colors.yellow}⚠️  No skillforge.config.json found — running in self-test mode against framework example artifacts.${colors.reset}\n`);
    }
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const gate of activeGates) {
    const resolved = resolveGateTargets(gate, config, { selfTest });

    if (!isJson) process.stdout.write(`Evaluating [${gate.name}]... `);

    if (resolved.missing) {
      if (allowMissing) {
        if (!isJson) console.log(`${colors.yellow}⏭ SKIPPED (artifact not configured)${colors.reset}`);
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'SKIPPED',
          reason: `No "${gate.artifactKey}" artifact configured in skillforge.config.json.`,
          unresolved: resolved.unresolved,
        });
        skipped++;
      } else {
        if (!isJson) console.log(`${colors.red}✖ FAILED (missing artifact)${colors.reset}`);
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'FAILED',
          reason: `Required artifact "${gate.artifactKey}" is not configured or does not exist.`,
          unresolved: resolved.unresolved,
        });
        failed++;
      }
      continue;
    }

    try {
      let sawWarning = false;
      for (const target of resolved.targets) {
        const output = runNode(gate.script, [target]);
        if (/⚠️\s+WARNING/i.test(output)) sawWarning = true;
      }

      if (isStrict && sawWarning) {
        if (!isJson) console.log(`${colors.red}✖ FAILED (Strict Warning)${colors.reset}`);
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'FAILED',
          reason: 'Strict mode warning detected',
          targets: resolved.targets,
        });
        failed++;
      } else {
        if (!isJson) console.log(`${colors.green}✔ PASSED${colors.reset}`);
        results.push({
          id: gate.id,
          name: gate.name,
          phase: gate.phase,
          status: 'PASSED',
          warnings: sawWarning,
          targets: resolved.targets,
        });
        passed++;
      }
    } catch (err) {
      const raw = String((err && (err.stdout || err.stderr)) || (err && err.message) || 'validation failed').trim();
      const message = raw.split('\n').filter(Boolean).slice(-1)[0] || 'validation failed';
      if (!isJson) console.log(`${colors.red}✖ FAILED${colors.reset}`);
      results.push({
        id: gate.id,
        name: gate.name,
        phase: gate.phase,
        status: 'FAILED',
        error: message,
        targets: resolved.targets,
      });
      failed++;
    }
  }

  const summary = {
    timestamp: new Date().toISOString(),
    mode: selfTest ? 'self-test' : 'project',
    configSource: config.source,
    totalGates: activeGates.length,
    passed,
    failed,
    skipped,
    status: failed === 0 ? 'PASSED' : 'FAILED',
    gates: results,
  };

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
  console.log(`Summary: ${passed} Passed, ${failed} Failed, ${skipped} Skipped out of ${activeGates.length} Total Gates`);
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);

  if (failed > 0) {
    printError('One or more SDLC quality gates failed. Please check the logs above.');
    process.exit(1);
  } else {
    printSuccess('ALL SDLC QUALITY GATES PASSED! Project is ready for production.\n');
    process.exit(0);
  }
}
