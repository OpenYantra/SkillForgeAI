/**
 * SkillForgeAI core semantic diff engine.
 *
 * Shared by `src/cli/commands/diff.mjs` and
 * `scripts/detect-breaking-changes.mjs`. Uses argument-array git invocations
 * (no shell interpolation).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function runGit(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf-8', ...opts });
}

function tryGit(args) {
  try {
    return runGit(args);
  } catch {
    return '';
  }
}

function splitLines(output) {
  return output
    .split('\n')
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter((line) => line.length > 0);
}

/**
 * List changed files for the current working tree.
 * @param {{staged?: boolean, target?: string|null}} [options]
 * @returns {string[]}
 */
export function getGitChangedFiles(options = {}) {
  if (options.staged) {
    return [...new Set(splitLines(tryGit(['diff', '--name-only', '--cached'])))];
  }

  let diffOutput;
  if (options.target) {
    diffOutput =
      tryGit(['diff', '--name-only', `origin/${options.target}...HEAD`]) ||
      tryGit(['diff', '--name-only', `${options.target}...HEAD`]);
  } else {
    diffOutput = tryGit(['diff', '--name-only', 'HEAD']);
  }

  const staged = tryGit(['diff', '--name-only', '--cached']);
  const untracked = tryGit(['ls-files', '--others', '--exclude-standard']);

  return [...new Set([...splitLines(diffOutput), ...splitLines(staged), ...splitLines(untracked)])];
}

/**
 * Unified diff for a single file.
 * @param {string} file
 * @param {{target?: string|null}} [options]
 */
export function getDiffForFile(file, options = {}) {
  const base = options.target ? `${options.target}...HEAD` : 'HEAD';
  return tryGit(['diff', '-U0', base, '--', file]);
}

/**
 * @param {string[]} changedFiles
 * @param {{target?: string|null}} [options]
 * @returns {{classifications: {destructive: object[], additive: object[], patch: object[]}, highestSeverity: string}}
 */
export function classifyChanges(changedFiles, options = {}) {
  let highestSeverity = 'PATCH';
  const classifications = {
    destructive: [],
    additive: [],
    patch: [],
  };

  for (const file of changedFiles) {
    const isInterfaceOrPort = /ports?[\\/]|repository\.(ts|cs|go|py)|interfaces?[\\/]/i.test(file);
    const isContract = /openapi\.(yaml|json)|schema\.(json|yaml)|contracts?[\\/]/i.test(file);

    if (isInterfaceOrPort || isContract) {
      const diff = getDiffForFile(file, options);
      const lines = diff.split('\n');

      const removedLines = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
      const addedLines = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));

      if (removedLines.length > 0) {
        classifications.destructive.push({
          file,
          reason: `Detected ${removedLines.length} deleted/modified line(s) in contract or interface.`,
        });
        highestSeverity = 'MAJOR';
      } else if (addedLines.length > 0) {
        classifications.additive.push({
          file,
          reason: `Detected ${addedLines.length} newly added interface/contract capability.`,
        });
        if (highestSeverity !== 'MAJOR') highestSeverity = 'MINOR';
      }
    } else {
      classifications.patch.push({
        file,
        reason: 'Internal implementation, documentation, or test modification.',
      });
    }
  }

  return { classifications, highestSeverity };
}

/**
 * Load the cached code graph used for downstream-impact lookups.
 * @param {string} [graphPath]
 * @returns {{nodes: Record<string, {importedBy?: string[]}>}}
 */
export function loadCachedGraph(graphPath = path.join('docs', 'context', 'code-graph.json')) {
  if (!fs.existsSync(graphPath)) return { nodes: {} };
  try {
    return JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  } catch {
    return { nodes: {} };
  }
}

/**
 * Compute the full diff report (usable by CLI, scripts and MCP tools).
 * @param {{staged?: boolean, target?: string|null}} [options]
 */
export function analyzeDiff(options = {}) {
  const changedFiles = getGitChangedFiles(options);
  const graph = loadCachedGraph();

  const affectedCallers = new Set();
  for (const file of changedFiles) {
    if (graph.nodes[file]) {
      const callers = graph.nodes[file].importedBy || [];
      callers.forEach((caller) => affectedCallers.add(caller));
    }
  }

  const { classifications, highestSeverity } = classifyChanges(changedFiles, options);

  return {
    report: {
      timestamp: new Date().toISOString(),
      target: options.target || 'HEAD',
      totalChangedFiles: changedFiles.length,
      changedFiles,
      affectedCallers: [...affectedCallers],
      highestSeverity,
      classifications,
    },
    changedFiles,
    affectedCallers,
    classifications,
    highestSeverity,
  };
}
