/**
 * Dockerfile hardening & CI/CD workflow validator (Phase 6).
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { emptyResult, finalize } from './common.mjs';

const TEST_COMMAND_RE =
  /\b(npm\s+(?:run\s+)?test|node\s+[^\n]*--test|vitest|jest|dotnet\s+test|pytest|python\s+-m\s+(?:pytest|unittest)|go\s+test|mvn\s+[^\n]*test|gradle[^\n]*test)\b/i;

/**
 * Split a Dockerfile into logical instructions (joining line continuations).
 * @param {string} content
 * @returns {string[]}
 */
export function parseDockerfileInstructions(content) {
  const instructions = [];
  let pending = '';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!pending && (!line.trim() || /^\s*#/.test(line))) continue;

    const trimmed = line.trimEnd();
    if (trimmed.endsWith('\\')) {
      pending += `${trimmed.slice(0, -1)} `;
      continue;
    }

    pending += trimmed;
    if (pending.trim()) instructions.push(pending.trim());
    pending = '';
  }

  if (pending.trim()) instructions.push(pending.trim());
  return instructions;
}

/**
 * @param {string} content
 * @param {string} label
 * @param {{errors: string[], warnings: string[], details: object}} result
 */
export function validateDockerfileContent(content, label, result) {
  const instructions = parseDockerfileInstructions(content);
  const fromCount = instructions.filter((line) => /^FROM\s+/i.test(line)).length;
  if (fromCount === 0) {
    result.errors.push(`${label}: no FROM instruction found (not a Dockerfile?).`);
    return;
  }
  if (fromCount < 2) {
    result.warnings.push(
      `${label}: single-stage Dockerfile detected. Recommend multi-stage builds to minimize image attack surface.`,
    );
  }

  const userLine = instructions.find((line) => /^USER\s+/i.test(line));
  if (!userLine) {
    result.errors.push(`${label}: no unprivileged USER specified. Root execution is forbidden.`);
  } else if (/^USER\s+(root|0)\b/i.test(userLine)) {
    result.errors.push(`${label}: container runs as root. Specify an unprivileged USER.`);
  }

  if (!instructions.some((line) => /^HEALTHCHECK\b/i.test(line))) {
    result.warnings.push(`${label}: no HEALTHCHECK instruction defined.`);
  }

  result.details.dockerfiles = (result.details.dockerfiles || 0) + 1;
}

/**
 * @param {string} content
 * @param {string} label
 * @param {{errors: string[], warnings: string[], details: object}} result
 */
export function validateWorkflowContent(content, label, result) {
  let document;
  try {
    document = parseYaml(content);
  } catch (err) {
    result.errors.push(`${label}: invalid YAML (${err.message}).`);
    return;
  }

  if (!document || typeof document !== 'object') {
    result.errors.push(`${label}: workflow root must be a mapping.`);
    return;
  }

  const triggers = document.on;
  const triggerNames = Array.isArray(triggers)
    ? triggers
    : typeof triggers === 'string'
      ? [triggers]
      : triggers && typeof triggers === 'object'
        ? Object.keys(triggers)
        : [];
  if (!triggerNames.some((trigger) => trigger === 'push' || trigger === 'pull_request')) {
    result.warnings.push(`${label}: CI workflow should trigger on pull_request or push events.`);
  }

  const jobs = document.jobs && typeof document.jobs === 'object' ? document.jobs : {};
  const commands = [];
  for (const job of Object.values(jobs)) {
    if (!job || !Array.isArray(job.steps)) continue;
    for (const step of job.steps) {
      if (step && typeof step.run === 'string') commands.push(step.run);
    }
  }

  if (!commands.some((command) => TEST_COMMAND_RE.test(command))) {
    result.errors.push(`${label}: CI workflow does not appear to run automated tests.`);
  }

  result.details.workflows = (result.details.workflows || 0) + 1;
}

function isDockerfileName(name) {
  const lower = name.toLowerCase();
  return lower === 'dockerfile' || lower.startsWith('dockerfile.') || lower.endsWith('.dockerfile');
}

function collectCandidates(target) {
  if (!fs.statSync(target).isDirectory()) {
    return [target];
  }

  const found = [];
  const workflowsDir = path.join(target, '.github', 'workflows');
  if (fs.existsSync(workflowsDir)) {
    for (const entry of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
      if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) found.push(path.join(workflowsDir, entry.name));
    }
  }

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'bin', 'obj', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (isDockerfileName(entry.name)) {
        found.push(path.join(dir, entry.name));
      }
    }
  };
  walk(target);

  return found;
}

/**
 * @param {string} target file or directory
 */
export function validateCiContainer(target) {
  const result = emptyResult();
  if (!target || !fs.existsSync(target)) {
    result.errors.push(target ? `Path not found at "${target}".` : 'Please specify a Dockerfile or CI workflow path.');
    return finalize(result);
  }

  const candidates = collectCandidates(target);
  if (candidates.length === 0) {
    result.errors.push('No Dockerfile or CI workflow (*.yml/*.yaml) found in the target directory.');
    return finalize(result);
  }

  for (const file of candidates) {
    const label = path.basename(file);
    const content = fs.readFileSync(file, 'utf-8');
    if (isDockerfileName(label)) {
      validateDockerfileContent(content, label, result);
    } else if (/\.ya?ml$/i.test(label)) {
      validateWorkflowContent(content, label, result);
    }
  }

  return finalize(result);
}
