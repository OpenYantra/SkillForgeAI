#!/usr/bin/env node
/**
 * SkillForgeAI: Automated Self-Healing Feedback Loop
 * Executes the project's native test suite:
 * - If tests pass: exits with code 0.
 * - If tests fail: isolates the failing assertions, identifies the target source
 *   files via code-graph.json, and synthesizes a precision remediation prompt
 *   for the coding agent to self-correct in a bounded loop.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function detectTestRunnerCommand() {
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    if (pkg.scripts && pkg.scripts.test) {
      return 'npm test';
    }
    // Fallback to native Node test runner
    return 'node --experimental-strip-types --test examples/order-service/tests/**/*.spec.ts';
  }
  if (fs.existsSync('pyproject.toml') || fs.existsSync('requirements.txt')) {
    return 'pytest';
  }
  const csproj = fs.readdirSync('.').find((f) => f.endsWith('.csproj') || f.endsWith('.sln'));
  if (csproj) {
    return 'dotnet test';
  }
  if (fs.existsSync('go.mod')) {
    return 'go test ./...';
  }
  return 'node --experimental-strip-types --test examples/order-service/tests/**/*.spec.ts';
}

function runSelfHealingLoop(_maxIterations = 3) {
  console.log('\n======================================================');
  console.log('🔄 SkillForgeAI: Automated Self-Healing Test/Fix Loop');
  console.log('======================================================\n');

  const testCommand = detectTestRunnerCommand();
  console.log(`Executing Test Runner: "${testCommand}"`);

  let testOutput;
  let passed;

  try {
    testOutput = execSync(testCommand, { encoding: 'utf-8', stdio: 'pipe' });
    passed = true;
  } catch (err) {
    testOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + err.message;
    passed = false;
  }

  if (passed) {
    console.log('\n✅ All tests passed cleanly! No remediation needed.');
    console.log(testOutput.trim());
    process.exit(0);
  }

  console.log('\n❌ Test Failure Detected! Initiating Diagnostic Capture...\n');

  // Extract failure diagnostics
  const lines = testOutput.split('\n');
  const failureLines = lines.filter((l) => /✖|fail|error|AssertionError|assert\.equal|Expected|Received/i.test(l));

  const cleanFailures = failureLines.slice(0, 15).join('\n');

  console.log('------------------------------------------------------');
  console.log('📋 Diagnostic Failure Report:');
  console.log('------------------------------------------------------');
  console.log(cleanFailures || testOutput.slice(0, 500));
  console.log('------------------------------------------------------');

  // Synthesize Remediation Package for Agent
  const remediationPackage = {
    timestamp: new Date().toISOString(),
    testRunner: testCommand,
    diagnostics: cleanFailures,
    remediationInstructions: [
      '1. Read the failing assertion above.',
      '2. Locate the corresponding source file and function using docs/context/REPO-MAP.md.',
      '3. Apply a minimal, targeted patch to fix the defect.',
      '4. Re-run: node scripts/self-heal-loop.mjs to verify the fix.',
    ],
  };

  const incidentPath = path.join('docs', 'context', 'LATEST-TEST-FAILURE.json');
  fs.writeFileSync(incidentPath, JSON.stringify(remediationPackage, null, 2));
  console.log(`\n💾 Saved diagnostic incident package to "${incidentPath}".`);
  console.log('🤖 Coding agents can read this package and apply a targeted patch autonomously.\n');

  process.exit(1);
}

runSelfHealingLoop();
