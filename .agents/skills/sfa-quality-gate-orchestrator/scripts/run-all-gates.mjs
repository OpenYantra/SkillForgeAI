#!/usr/bin/env node
/**
 * Quality Gate Orchestrator Runner
 * Orchestrates quality verification across all 7 SDLC phases.
 *
 * Uses the canonical gate registry + project configuration so it validates the
 * same artifacts as `skillforge gate` (default: skillforge.config.json).
 */

import { GATE_REGISTRY, loadGateConfig, isSelfTest, resolveGateTargets } from '../../../../src/core/gate-registry.mjs';
import { runNode } from '../../../../src/core/exec.mjs';

function parseArgs(argv) {
  const phaseIndex = argv.indexOf('--phase');
  const configIndex = argv.indexOf('--config');
  return {
    phase: phaseIndex !== -1 ? argv[phaseIndex + 1] : null,
    configPath: configIndex !== -1 ? argv[configIndex + 1] : undefined,
    allowMissing: argv.includes('--allow-missing'),
    selfTest: argv.includes('--self-test'),
  };
}

function runGates(options = {}) {
  console.log('\n======================================================');
  console.log('🛡️  SkillForgeAI: Unified SDLC Quality Gate Evaluation');
  console.log('======================================================\n');

  let config;
  try {
    config = loadGateConfig(options.configPath);
  } catch (err) {
    console.error(`❌ Failed to load gate config: ${err.message}`);
    process.exit(2);
  }

  const selfTest = isSelfTest(config, { selfTest: options.selfTest });
  console.log(`Mode: ${selfTest ? 'self-test' : 'project'} (config: ${config.source})\n`);

  const activeGates = options.phase
    ? GATE_REGISTRY.filter((g) => g.phase === Number(options.phase))
    : GATE_REGISTRY;

  if (activeGates.length === 0) {
    console.error(`❌ No quality gates found for phase: ${options.phase}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const results = [];

  for (const gate of activeGates) {
    const resolved = resolveGateTargets(gate, config, { selfTest });
    process.stdout.write(`Evaluating [${gate.name}]... `);

    if (resolved.missing) {
      if (options.allowMissing) {
        console.log('⏭ SKIPPED (artifact not configured)');
        results.push({ name: gate.name, status: 'SKIPPED' });
        skipped++;
      } else {
        console.log('❌ FAILED (missing artifact)');
        results.push({ name: gate.name, status: 'FAILED', reason: 'missing artifact' });
        failed++;
      }
      continue;
    }

    try {
      for (const target of resolved.targets) {
        runNode(gate.script, [target]);
      }
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
  console.log(`Summary: ${passed} Passed, ${failed} Failed, ${skipped} Skipped out of ${activeGates.length} Total Gates`);
  console.log('------------------------------------------------------');

  if (failed > 0) {
    console.log('\n⚠️  One or more SDLC quality gates failed. Check logs above.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SDLC QUALITY GATES PASSED! Project is ready for production.\n');
    process.exit(0);
  }
}

runGates(parseArgs(process.argv.slice(2)));
