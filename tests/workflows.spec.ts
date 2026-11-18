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
    const gateIndex = runStepIndex(steps, '.skillforge-eval/bin/skillforge.mjs gate');
    const diffIndex = runStepIndex(steps, '.skillforge-eval/bin/skillforge.mjs diff');

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

  it('exempts Dependabot from the protected-path label', () => {
    const workflow = loadWorkflow('skillforge-gate.yml');
    const steps = stepsOf(workflow, 'evaluate-sdlc-gates');
    const guard = steps.find((step) => step.name === 'Guard protected enforcement paths');

    assert.ok(guard, 'expected the protected-path guard step');
    assert.match(String(guard.if), /dependabot\[bot\]/);
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

describe('dependabot policy', () => {
  const config = parseYaml(fs.readFileSync(path.join(REPO_ROOT, '.github', 'dependabot.yml'), 'utf-8')) as Record<
    string,
    any
  >;
  const updates = config.updates as Array<Record<string, any>>;
  const npm = updates.find((update) => update['package-ecosystem'] === 'npm');
  const actions = updates.find((update) => update['package-ecosystem'] === 'github-actions');

  it('limits grouped pull requests and schedules actions monthly', () => {
    assert.ok(npm, 'expected the npm ecosystem');
    assert.ok(actions, 'expected the github-actions ecosystem');
    assert.equal(npm['open-pull-requests-limit'], 2);
    assert.equal(actions['open-pull-requests-limit'], 2);
    assert.equal(npm.schedule.interval, 'weekly');
    assert.equal(actions.schedule.interval, 'monthly');
  });

  it('ignores parser 0.x minors and runtime-mismatched type majors', () => {
    type IgnoreEntry = { name: string; types: string[] };
    const ignores = (update: Record<string, any>): IgnoreEntry[] =>
      ((update.ignore || []) as Array<Record<string, any>>).map((entry) => ({
        name: String(entry['dependency-name']),
        types: (entry['update-types'] as string[]) || [],
      }));

    const npmIgnores = ignores(npm!);
    const parserIgnore = npmIgnores.find((entry) => entry.name === 'tree-sitter*');
    assert.ok(parserIgnore, 'expected a tree-sitter ignore rule');
    assert.ok(parserIgnore.types.includes('version-update:semver-minor'));
    assert.ok(parserIgnore.types.includes('version-update:semver-major'));

    assert.ok(
      npmIgnores.some((entry) => entry.name === '@types/node' && entry.types.includes('version-update:semver-major')),
      'expected @types/node major updates to be ignored',
    );

    const typescriptIgnore = npmIgnores.find((entry) => entry.name === 'typescript');
    assert.ok(typescriptIgnore, 'expected a typescript ignore rule');
    assert.ok(typescriptIgnore.types.includes('version-update:semver-minor'));
    assert.ok(typescriptIgnore.types.includes('version-update:semver-major'));

    assert.ok(
      ignores(actions!).some((entry) => entry.name === '*' && entry.types.includes('version-update:semver-major')),
      'expected action major updates to be ignored',
    );
  });
});
