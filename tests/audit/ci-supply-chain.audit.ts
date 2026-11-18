/**
 * AUD-C: GitHub Actions supply-chain surface.
 *
 * Static assertions over .github/workflows. Tests fail where the pipeline can
 * be hijacked by PR-controlled code or a compromised dependency.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadWorkflows, REPO_ROOT, workflowSteps } from './helpers/audit.ts';

const workflows = loadWorkflows(parseYaml);
const steps = workflowSteps(workflows);

const label = (step: { file: string; job: string }) => `${step.file}:${step.job}`;

describe('AUD-C: CI supply chain', () => {
  it('AUD-C01: third-party actions must be pinned to a full commit SHA', () => {
    const unpinned = steps
      .filter((entry) => typeof entry.step.uses === 'string' && !/@[0-9a-f]{40}$/.test(entry.step.uses))
      .map((entry) => `${label(entry)}: ${entry.step.uses}`);

    assert.deepEqual(unpinned, [], `actions pinned to mutable tags: ${unpinned.join('; ')}`);
  });

  it('AUD-C02: npm ci must disable dependency lifecycle scripts', () => {
    const offenders = steps
      .filter(
        (entry) =>
          typeof entry.step.run === 'string' &&
          /\bnpm ci\b/.test(entry.step.run) &&
          !/--ignore-scripts/.test(entry.step.run),
      )
      .map(label);

    assert.deepEqual(offenders, [], `npm ci runs install scripts (postinstall RCE) in: ${offenders.join(', ')}`);
  });

  it('AUD-C03: actions/checkout must not persist credentials', () => {
    const offenders = steps
      .filter((entry) => String(entry.step.uses || '').startsWith('actions/checkout'))
      .filter((entry) => !(entry.step.with && entry.step.with['persist-credentials'] === false))
      .map(label);

    assert.deepEqual(
      offenders,
      [],
      `checkout persists GITHUB_TOKEN into .git/config for PR code to read: ${offenders.join(', ')}`,
    );
  });

  it('AUD-C04: gate/diff commands must not be masked with "|| true"', () => {
    const masked = steps
      .filter((entry) => typeof entry.step.run === 'string' && /\|\|\s*(true|:)\s*$/m.test(entry.step.run))
      .map((entry) => `${label(entry)}: ${String(entry.step.run).trim().split('\n').pop()}`);

    assert.deepEqual(masked, [], `failures are swallowed by "|| true": ${masked.join('; ')}`);
  });

  it('AUD-C05: the gate workflow must guard protected paths', () => {
    const gateWorkflow = workflows.find((workflow) => workflow.file === 'skillforge-gate.yml');
    assert.ok(gateWorkflow, 'skillforge-gate.yml not found');

    assert.match(
      gateWorkflow!.raw,
      /git diff --name-only[^\n]*origin\/main|PROTECTED_PATHS|protected-path/i,
      'the PR can edit src/core, bin, .github/workflows, or skillforge.config.json without a guard',
    );
  });

  it('AUD-C06: jobs with write tokens must not execute PR code', () => {
    const writeJobs = new Set<string>();
    for (const workflow of workflows) {
      // Report-only workflows are triggered by workflow_run and execute trusted
      // default-branch code without checking out the pull request.
      if (/(^|\n)\s*workflow_run:/.test(workflow.raw)) continue;

      const jobs = (workflow.doc && workflow.doc.jobs) || {};
      for (const [name, job] of Object.entries(jobs as Record<string, any>)) {
        const permissions = (job && job.permissions) || {};
        if (permissions['pull-requests'] === 'write' || permissions.contents === 'write') {
          writeJobs.add(`${workflow.file}:${name}`);
        }
      }
    }

    const offenders = steps
      .filter((entry) => writeJobs.has(label(entry)))
      .filter(
        (entry) =>
          typeof entry.step.run === 'string' &&
          /(npm ci|node bin\/skillforge|node scripts\/|npm run)/.test(entry.step.run),
      )
      .map((entry) => `${label(entry)}: ${String(entry.step.run).split('\n')[0]}`);

    assert.deepEqual(offenders, [], `untrusted PR code executes with a write token: ${offenders.join('; ')}`);
  });

  it('AUD-C07: workflows must declare a least-privilege top-level permissions block', () => {
    const missing = workflows.filter((workflow) => !workflow.doc.permissions).map((workflow) => workflow.file);
    assert.deepEqual(missing, [], `workflows inherit the repository default token scope: ${missing.join(', ')}`);
  });

  it('AUD-C08: a dependency update bot must cover npm and github-actions', () => {
    const dependabotPath = path.join(REPO_ROOT, '.github', 'dependabot.yml');
    assert.ok(fs.existsSync(dependabotPath), '.github/dependabot.yml is missing');

    const config = parseYaml(fs.readFileSync(dependabotPath, 'utf-8')) as Record<string, any>;
    const ecosystems = (config.updates || []).map((update: any) => update['package-ecosystem']);
    assert.ok(ecosystems.includes('npm'), 'Dependabot does not track npm dependencies');
    assert.ok(ecosystems.includes('github-actions'), 'Dependabot does not track GitHub Actions');
  });

  it('AUD-C09: CI must run a dependency vulnerability review', () => {
    const runsAudit = steps.some(
      (entry) => typeof entry.step.run === 'string' && /npm audit|dependency-review/.test(entry.step.run),
    );
    const usesReview = steps.some((entry) =>
      String(entry.step.uses || '').startsWith('actions/dependency-review-action'),
    );

    assert.ok(runsAudit || usesReview, 'no npm audit / dependency-review step exists in CI');
  });

  it('AUD-C10: workflows must not combine pull_request_target with a head checkout', () => {
    const unsafe = workflows
      .filter((workflow) => /pull_request_target/.test(workflow.raw))
      .map((workflow) => workflow.file);
    assert.deepEqual(unsafe, [], `pull_request_target grants a write token to fork PR context: ${unsafe.join(', ')}`);
  });

  it('AUD-C11: only first-party action owners may be used', () => {
    const allowed = new Set(['actions', 'github']);
    const foreign = steps
      .filter((entry) => typeof entry.step.uses === 'string')
      .map((entry) => String(entry.step.uses).split('/')[0])
      .filter((owner) => !allowed.has(owner));

    assert.deepEqual(foreign, [], `third-party action owners require explicit review: ${foreign.join(', ')}`);
  });
});
