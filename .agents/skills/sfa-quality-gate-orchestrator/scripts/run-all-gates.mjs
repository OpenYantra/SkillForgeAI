#!/usr/bin/env node
/**
 * Quality Gate Orchestrator Runner
 * Thin wrapper over `src/core/gate-runner.mjs` so the skill and the CLI share
 * identical gate selection, validation and reporting.
 */

import fs from 'node:fs';
import path from 'node:path';
import { runGates } from '../../../../src/core/gate-runner.mjs';

function parseArgs(argv) {
  const phaseIndex = argv.indexOf('--phase');
  const configIndex = argv.indexOf('--config');
  const outIndex = argv.indexOf('--out');
  return {
    phase: phaseIndex !== -1 ? argv[phaseIndex + 1] : null,
    configPath: configIndex !== -1 ? argv[configIndex + 1] : undefined,
    outFile: outIndex !== -1 ? argv[outIndex + 1] : undefined,
    allowMissing: argv.includes('--allow-missing'),
    selfTest: argv.includes('--self-test'),
    strict: argv.includes('--strict'),
    json: argv.includes('--json'),
  };
}

async function runGatesCli(options = {}) {
  if (!options.json) {
    console.log('\n======================================================');
    console.log('🛡️  SkillForgeAI: Unified SDLC Quality Gate Evaluation');
    console.log('======================================================\n');
  }

  let result;
  try {
    result = await runGates({
      configPath: options.configPath,
      phase: options.phase,
      selfTest: options.selfTest ? true : undefined,
      allowMissing: options.allowMissing,
      strict: options.strict,
    });
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  const { summary } = result;

  if (options.json || options.outFile) {
    const json = JSON.stringify(summary, null, 2);
    if (options.outFile) {
      const dir = path.dirname(options.outFile);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(options.outFile, json);
    }
    if (options.json) console.log(json);
    process.exit(summary.status === 'PASSED' ? 0 : 1);
  }

  console.log(`Mode: ${summary.mode} (config: ${summary.configSource})\n`);

  for (const gate of summary.gates) {
    if (gate.status === 'PASSED') {
      console.log(`Evaluating [${gate.name}]... ✅ PASSED`);
    } else if (gate.status === 'SKIPPED') {
      console.log(`Evaluating [${gate.name}]... ⏭ SKIPPED (artifact not configured)`);
    } else if (gate.reason === 'Strict mode warning detected') {
      console.log(`Evaluating [${gate.name}]... ❌ FAILED (Strict Warning)`);
    } else if (gate.reason && gate.reason.startsWith('Required artifact')) {
      console.log(`Evaluating [${gate.name}]... ❌ FAILED (missing artifact)`);
    } else {
      console.log(`Evaluating [${gate.name}]... ❌ FAILED`);
    }
    if (gate.status === 'FAILED' && gate.error) console.log(`   ${gate.error}`);
  }

  console.log('\n------------------------------------------------------');
  console.log(
    `Summary: ${summary.passed} Passed, ${summary.failed} Failed, ${summary.skipped} Skipped out of ${summary.totalGates} Total Gates`,
  );
  console.log('------------------------------------------------------');

  if (summary.failed > 0) {
    console.log('\n⚠️  One or more SDLC quality gates failed. Check logs above.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SDLC QUALITY GATES PASSED! Project is ready for production.\n');
    process.exit(0);
  }
}

await runGatesCli(parseArgs(process.argv.slice(2)));
