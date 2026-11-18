/**
 * Shared helpers for the read-only security audit repro suites.
 *
 * These suites assert the SECURE behaviour of SkillForgeAI. They are expected
 * to FAIL against the current implementation and exist to demonstrate the
 * findings recorded in docs/audit/2026-11-skillforge-audit.md.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO_ROOT,
  makeTempDir,
  removeDir,
  writeFiles,
  initGitRepo,
  commitAll,
  runGit,
  runNode,
} from '../../helpers/workspace.ts';

export { REPO_ROOT, makeTempDir, removeDir, writeFiles, initGitRepo, commitAll, runGit, runNode };

export const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');
export const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'audit', 'fixtures');

export function fixture(...segments: string[]): string {
  return path.join(FIXTURES_DIR, ...segments);
}

export function frameworkModule(relativePath: string): string {
  return pathToFileURL(path.join(REPO_ROOT, relativePath)).href;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Framework-owned self-test artifacts, used to make the baseline pass. */
export function templateArtifacts(): Record<string, string> {
  return {
    plan: '.agents/skills/sfa-project-planner-estimator/templates/project-plan-template.md',
    prd: 'examples/order-service/order-service.prd.md',
    openapi: '.agents/skills/sfa-api-contract-designer/templates/openapi-template.yaml',
    architecture: '.agents/skills/sfa-system-architecture-adr/templates/architecture-spec-template.md',
    signoff: 'examples/order-service/docs/approvals/order-service-signoff.md',
    src: 'examples/order-service/src',
    tests: 'examples/order-service/tests/order.service.spec.ts',
    dockerfile: '.agents/skills/sfa-cicd-container-automator/templates/Dockerfile.template',
    rca: '.agents/skills/sfa-incident-root-cause-analyzer/templates/rca-report-template.md',
  };
}

export function projectConfig(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    version: 2,
    mode: 'project',
    artifacts: templateArtifacts(),
    governance: {
      allowedReviewers: ['human@corp.com'],
      requireSignedCommits: true,
      signoffTtlDays: 3650,
      allowAgentIdentities: false,
    },
    ...overrides,
  };
}

export interface SignoffDocOptions {
  status?: string;
  reviewer?: string;
  date?: string;
  /** Commit/Artifact Hash field. Pass '' to omit the field entirely. */
  hash?: string;
  authorization?: string;
  extraLines?: string[];
}

export function signoffDoc(options: SignoffDocOptions = {}): string {
  const {
    status = 'APPROVED',
    reviewer = 'Dana Human',
    date = '2026-11-10',
    hash = 'abc123',
    authorization = '- [x] Authorized to proceed to **Phase 4: Feature Scaffolding & Implementation**',
    extraLines = [],
  } = options;

  const lines = [
    '# SDLC Phase Sign-Off: demo',
    '',
    '- **Target Phase:** Phase 3',
    `- **Status:** ${status}`,
    `- **Reviewed By (Human):** ${reviewer}`,
    '- **Reviewer Role:** Lead Architect',
    `- **Approval Date:** ${date}`,
    ...(hash ? [`- **Commit / Artifact Hash:** ${hash}`] : []),
    '',
    '---',
    '',
    '## 1. Review Checklist & Verification',
    '- [x] Scope and non-goals are clearly bounded.',
    '',
    '---',
    '',
    '## 2. Reviewer Notes & Approvals',
    '',
    '**Authorized Next Phase:**',
    authorization,
    '',
    ...extraLines,
  ];
  return lines.join('\n');
}

export function writeSignoffFile(content: string): string {
  const dir = makeTempDir('audit-signoff');
  const file = path.join(dir, 'signoff.md');
  fs.writeFileSync(file, content);
  return file;
}

export function gitStub(
  hash = 'abc123',
  email = 'human@corp.com',
  signature = 'G',
  date = '2026-11-15T00:00:00Z',
): string {
  return `${hash}|${email}|${signature}|${date}`;
}

export interface WorkflowFile {
  file: string;
  raw: string;
  doc: Record<string, any>;
}

export function loadWorkflows(parseYaml: (raw: string) => any): WorkflowFile[] {
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf-8');
      return { file, raw, doc: parseYaml(raw) as Record<string, any> };
    });
}

export interface WorkflowStep {
  file: string;
  job: string;
  step: Record<string, any>;
}

export function workflowSteps(workflows: WorkflowFile[]): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  for (const workflow of workflows) {
    const jobs = (workflow.doc && workflow.doc.jobs) || {};
    for (const [jobName, job] of Object.entries(jobs as Record<string, any>)) {
      const jobSteps = job && Array.isArray(job.steps) ? job.steps : [];
      for (const step of jobSteps) {
        if (step && typeof step === 'object') steps.push({ file: workflow.file, job: jobName, step });
      }
    }
  }
  return steps;
}

/** Run a node module snippet with an explicit working directory. */
export function runNodeInDir(dir: string, code: string): string {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: dir,
    encoding: 'utf-8',
  });
  return `${result.stdout || ''}${result.stderr || ''}`;
}

export function safeRemove(dir: string): void {
  try {
    removeDir(dir);
  } catch {
    // best-effort cleanup
  }
}
