/**
 * Test Suite: Skill validator scripts.
 * Exercises every shipped validator in both passing and failing modes.
 * Covers improvement.md #5 (8 skill validators).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeTempDir, removeDir, writeFiles, runNode, REPO_ROOT } from './helpers/workspace.ts';

function validator(relativePath: string): string {
  return path.join(REPO_ROOT, '.agents', 'skills', relativePath);
}

const VALID_CASES: Array<{ name: string; script: string; target: string }> = [
  {
    name: 'validate-plan',
    script: 'sfa-project-planner-estimator/scripts/validate-plan.mjs',
    target: '.agents/skills/sfa-project-planner-estimator/templates/project-plan-template.md',
  },
  {
    name: 'validate-prd',
    script: 'sfa-prd-generator-validator/scripts/validate-prd.mjs',
    target: 'examples/order-service/order-service.prd.md',
  },
  {
    name: 'validate-openapi',
    script: 'sfa-api-contract-designer/scripts/validate-openapi.mjs',
    target: '.agents/skills/sfa-api-contract-designer/templates/openapi-template.yaml',
  },
  {
    name: 'validate-architecture',
    script: 'sfa-system-architecture-adr/scripts/validate-architecture.mjs',
    target: '.agents/skills/sfa-system-architecture-adr/templates/architecture-spec-template.md',
  },
  {
    name: 'validate-rca',
    script: 'sfa-incident-root-cause-analyzer/scripts/validate-rca.mjs',
    target: '.agents/skills/sfa-incident-root-cause-analyzer/templates/rca-report-template.md',
  },
  {
    name: 'validate-ci-container',
    script: 'sfa-cicd-container-automator/scripts/validate-ci-container.mjs',
    target: '.agents/skills/sfa-cicd-container-automator/templates/Dockerfile.template',
  },
  {
    name: 'verify-scaffold',
    script: 'sfa-feature-scaffolder/scripts/verify-scaffold.mjs',
    target: 'examples/order-service/src',
  },
  {
    name: 'verify-coverage-criteria',
    script: 'sfa-unit-test-synthesizer/scripts/verify-coverage-criteria.mjs',
    target: 'examples/order-service/tests/order.service.spec.ts',
  },
];

describe('skill validators — passing artifacts', () => {
  for (const testCase of VALID_CASES) {
    it(`${testCase.name} accepts its self-test artifact`, () => {
      const result = runNode(validator(testCase.script), [path.join(REPO_ROOT, testCase.target)]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /PASSED/);
    });
  }
});

describe('skill validators — failing artifacts', () => {
  it('rejects incomplete documents', () => {
    const dir = makeTempDir('validators-invalid');
    try {
      writeFiles(dir, {
        'plan.md': '# Plan\n',
        'prd.md': '# PRD\n',
        'openapi.yaml': 'openapi: 2.0.0\n',
        'architecture.md': '# Architecture\n',
        'rca.md': '# RCA\n',
        'Dockerfile.bad': 'FROM node:24\nRUN echo hi\n',
        'ci.yml':
          'name: ci\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n',
        'domain/order.entity.ts': "import express from 'express';\nexport class OrderEntity {}\n",
        'empty.spec.ts': "it('does nothing', () => {});\n",
      });

      const cases: Array<{ script: string; target: string }> = [
        { script: 'sfa-project-planner-estimator/scripts/validate-plan.mjs', target: 'plan.md' },
        { script: 'sfa-prd-generator-validator/scripts/validate-prd.mjs', target: 'prd.md' },
        { script: 'sfa-api-contract-designer/scripts/validate-openapi.mjs', target: 'openapi.yaml' },
        { script: 'sfa-system-architecture-adr/scripts/validate-architecture.mjs', target: 'architecture.md' },
        { script: 'sfa-incident-root-cause-analyzer/scripts/validate-rca.mjs', target: 'rca.md' },
        { script: 'sfa-cicd-container-automator/scripts/validate-ci-container.mjs', target: 'Dockerfile.bad' },
        { script: 'sfa-cicd-container-automator/scripts/validate-ci-container.mjs', target: 'ci.yml' },
        { script: 'sfa-feature-scaffolder/scripts/verify-scaffold.mjs', target: 'domain' },
        { script: 'sfa-unit-test-synthesizer/scripts/verify-coverage-criteria.mjs', target: 'empty.spec.ts' },
      ];

      for (const testCase of cases) {
        const result = runNode(validator(testCase.script), [path.join(dir, testCase.target)]);
        assert.equal(result.status, 1, `${testCase.script} ${testCase.target}: ${result.stdout}`);
        assert.match(result.stdout, /FAILED/);
      }
    } finally {
      removeDir(dir);
    }
  });

  it('fails with a usage error when no target is supplied', () => {
    for (const testCase of VALID_CASES) {
      const result = runNode(validator(testCase.script));
      assert.equal(result.status, 1, `${testCase.name} should fail without a target`);
      assert.match(result.stderr + result.stdout, /Please specify/);
    }
  });
});
