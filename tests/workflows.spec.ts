/**
 * Test Suite: CI workflow wiring.
 * Guards against workflow regressions that leave required dependencies
 * uninstalled before running SkillForgeAI commands (see improvement.md #10/#17).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { REPO_ROOT } from './helpers/workspace.ts';

function loadWorkflow(name: string): Record<string, any> {
  const file = path.join(REPO_ROOT, '.github', 'workflows', name);
  return parseYaml(fs.readFileSync(file, 'utf-8')) as Record<string, any>;
}

function stepsOf(workflow: Record<string, any>, jobId: string): Array<Record<string, any>> {
  return workflow.jobs[jobId].steps as Array<Record<string, any>>;
}

function runStepIndex(steps: Array<Record<string, any>>, needle: string): number {
  return steps.findIndex((step) => typeof step.run === 'string' && step.run.includes(needle));
}

describe('skillforge-gate workflow', () => {
  it('installs dependencies before invoking the CLI', () => {
    const workflow = loadWorkflow('skillforge-gate.yml');
    const steps = stepsOf(workflow, 'evaluate-sdlc-gates');

    const installIndex = runStepIndex(steps, 'npm ci');
    const gateIndex = runStepIndex(steps, 'bin/skillforge.mjs gate');
    const diffIndex = runStepIndex(steps, 'bin/skillforge.mjs diff');

    assert.ok(installIndex !== -1, 'expected an "npm ci" step');
    assert.ok(gateIndex !== -1, 'expected the gate step');
    assert.ok(diffIndex !== -1, 'expected the diff step');
    assert.ok(installIndex < gateIndex, '"npm ci" must run before the quality gate');
    assert.ok(installIndex < diffIndex, '"npm ci" must run before the diff audit');
  });

  it('registers pull_request and push triggers', () => {
    const workflow = loadWorkflow('skillforge-gate.yml');
    const triggers = workflow.on;
    const names = Array.isArray(triggers) ? triggers : Object.keys(triggers);
    assert.ok(names.includes('pull_request'));
    assert.ok(names.includes('push'));
  });
});

describe('ci workflow', () => {
  it('runs lint, format, typecheck, tests, and coverage', () => {
    const workflow = loadWorkflow('ci.yml');
    const steps = stepsOf(workflow, 'node-quality');
    const runs = steps.map((step) => (typeof step.run === 'string' ? step.run : '')).join('\n');

    for (const command of [
      'npm run lint',
      'npm run format:check',
      'npm run typecheck',
      'npm run test:ts',
      'npm run test:coverage',
      'bin/skillforge.mjs graph --check',
      'scripts/sync-editors.mjs --check',
    ]) {
      assert.match(runs, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
