/**
 * SkillForgeAI self-healing engine.
 *
 * Detects test projects (single project or monorepo children), runs a bounded
 * test/fix loop, and packages failure diagnostics for a coding agent.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runCommand } from './exec.mjs';

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'bin',
  'obj',
  '.agents',
  '.gemini',
  '.vs',
  '.vscode',
  'docs',
]);

const FAILURE_LINE = /✖|fail|error|AssertionError|assert\.equal|Expected|Received/i;

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

/**
 * Detect a test project rooted at a directory.
 * @param {string} dir
 * @param {string} [base] directory used to compute the display root
 * @returns {{root: string, dir: string, stack: string, command: string, args: string[]}|null}
 */
export function detectTestProject(dir, base = process.cwd()) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;

  const root = toPosix(path.relative(base, path.resolve(dir))) || '.';
  const entry = (stack, command, args) => ({
    root,
    dir: path.resolve(dir),
    stack,
    command,
    args,
  });

  const packageJson = path.join(dir, 'package.json');
  if (fs.existsSync(packageJson)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
      if (pkg.scripts && typeof pkg.scripts.test === 'string') return entry('node', 'npm', ['test']);
    } catch {
      // Malformed package.json: ignore for detection, let the test runner report it.
    }
  }

  if (fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'requirements.txt'))) {
    return entry('python', 'pytest', []);
  }
  if (fs.existsSync(path.join(dir, 'go.mod'))) {
    return entry('go', 'go', ['test', './...']);
  }

  const hasDotnetProject = fs
    .readdirSync(dir, { withFileTypes: true })
    .some((item) => item.isFile() && (item.name.endsWith('.sln') || item.name.endsWith('.csproj')));
  if (hasDotnetProject) return entry('dotnet', 'dotnet', ['test']);

  return null;
}

/**
 * Discover the projects a heal run should cover.
 * - If the root itself is a test project, it wins unless `all` is set.
 * - Otherwise scan child directories up to `maxDepth` for project boundaries.
 * @param {string} [root]
 * @param {{maxDepth?: number, all?: boolean}} [options]
 */
export function discoverTestProjects(root = '.', options = {}) {
  const maxDepth = options.maxDepth ?? 3;
  const base = path.resolve(root);
  const rootProject = detectTestProject(base, base);
  if (rootProject && !options.all) return [rootProject];

  const projects = rootProject && options.all ? [rootProject] : [];

  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      const child = path.join(dir, entry.name);
      const project = detectTestProject(child, base);
      if (project) {
        projects.push(project);
      } else {
        walk(child, depth + 1);
      }
    }
  };

  walk(base, 1);
  return projects.sort((a, b) => a.root.localeCompare(b.root));
}

export function extractDiagnostics(result) {
  const output = [result.stdout || '', result.stderr || '', result.error ? result.error.message : ''].join('\n');
  const failures = output.split('\n').filter((line) => FAILURE_LINE.test(line));
  return failures.slice(0, 15).join('\n') || output.slice(0, 500);
}

function runFixer(fixScript, project) {
  const scriptPath = path.resolve(process.cwd(), fixScript);
  return spawnSync(process.execPath, [scriptPath, project.dir], {
    encoding: 'utf-8',
    cwd: project.dir,
  });
}

/**
 * Run the bounded test/fix loop.
 * @param {{
 *   projects?: Array<object>,
 *   maxIterations?: number,
 *   fixScript?: string|null,
 *   runner?: (project: object) => object,
 *   fixer?: (project: object, attempt: number) => object,
 * }} [options]
 */
export function runHealLoop(options = {}) {
  const projects = options.projects || [];
  const maxIterations = Math.max(1, Number(options.maxIterations) || 1);
  const runner =
    options.runner || ((project) => runCommand(project.command, project.args, { cwd: project.dir, stdio: 'pipe' }));

  const results = [];

  for (const project of projects) {
    let attempts = 0;
    let passed = false;
    let diagnostics = '';

    while (attempts < maxIterations) {
      attempts++;
      const result = runner(project);

      if (result.error && result.error.code === 'ENOENT') {
        diagnostics = `Test runner not found: ${result.error.message}`;
        break;
      }

      if (result.status === 0) {
        passed = true;
        break;
      }

      diagnostics = extractDiagnostics(result);

      if (attempts >= maxIterations || !options.fixScript) break;

      const fixResult = options.fixer ? options.fixer(project, attempts) : runFixer(options.fixScript, project);
      if (fixResult && fixResult.status !== 0) {
        diagnostics += `\n[fixer] ${(fixResult.stderr || fixResult.stdout || '').trim() || 'fixer failed'}`;
        break;
      }
    }

    results.push({
      root: project.root,
      dir: project.dir,
      stack: project.stack,
      testRunner: `${project.command} ${project.args.join(' ')}`.trim(),
      attempts,
      passed,
      diagnostics: passed ? '' : diagnostics,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    iterations: maxIterations,
    passed: results.length > 0 && results.every((result) => result.passed),
    projects: results,
  };
}

/**
 * Persist a remediation package for failing projects.
 * @param {ReturnType<typeof runHealLoop>} report
 * @param {string} [filePath]
 */
export function writeIncidentPackage(report, filePath = path.join('docs', 'context', 'LATEST-TEST-FAILURE.json')) {
  const dir = path.dirname(filePath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const failing = report.projects.filter((project) => !project.passed);
  const payload = {
    ...report,
    remediationInstructions: [
      '1. Read the failing assertions above for each project.',
      '2. Locate the corresponding source file and function using docs/context/REPO-MAP.md.',
      '3. Apply a minimal, targeted patch to fix the defect.',
      '4. Re-run: node scripts/self-heal-loop.mjs to verify the fix.',
    ],
    failingProjects: failing.map((project) => project.root),
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}
