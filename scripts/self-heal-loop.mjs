#!/usr/bin/env node
/**
 * Script wrapper: bounded self-healing test/fix loop.
 * The engine lives in `src/core/heal.mjs`.
 */

import fs from 'node:fs';
import { detectTestProject, discoverTestProjects, runHealLoop, writeIncidentPackage } from '../src/core/heal.mjs';

function parseArgs(argv) {
  const maxIndex = argv.indexOf('--max-iterations');
  const fixIndex = argv.indexOf('--fix');
  const projectIndex = argv.indexOf('--project');

  return {
    help: argv.includes('--help') || argv.includes('-h'),
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
    maxIterations: maxIndex !== -1 ? argv[maxIndex + 1] : '1',
    fixScript: fixIndex !== -1 ? argv[fixIndex + 1] : null,
    project: projectIndex !== -1 ? argv[projectIndex + 1] : null,
  };
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(2);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(`
Usage:
  node scripts/self-heal-loop.mjs [options]

Options:
  --max-iterations <n>   Maximum test/fix attempts per project (default: 1)
  --fix <script.mjs>     Node script run between attempts (receives the project dir)
  --project <dir>        Diagnose a single project directory
  --all                  Include the root project and nested projects
  --dry-run              Print the detected runner plan without executing tests
  --help, -h             Show this help message

Behavior:
  Without --fix the loop runs once and writes a remediation package. With
  --fix, a failing attempt invokes the fixer and retries up to --max-iterations.
`);
    process.exit(0);
  }

  if (options.fixScript && !fs.existsSync(options.fixScript)) {
    fail(`Fix script not found: ${options.fixScript}`);
  }

  if (!Number.isInteger(Number(options.maxIterations)) || Number(options.maxIterations) < 1) {
    fail(`Invalid --max-iterations: ${options.maxIterations}`);
  }

  let projects;
  if (options.project) {
    const project = detectTestProject(options.project);
    if (!project) fail(`No test project detected in: ${options.project}`);
    projects = [project];
  } else {
    projects = discoverTestProjects('.', { all: options.all });
  }

  console.log('\n======================================================');
  console.log('🔄 SkillForgeAI: Automated Self-Healing Test/Fix Loop');
  console.log('======================================================\n');

  if (projects.length === 0) {
    fail('No test projects detected. Add a package.json test script, pyproject.toml, go.mod, or .csproj/.sln.');
  }

  console.log(`Detected ${projects.length} test project(s):`);
  for (const project of projects) {
    console.log(`   📦 ${project.root} (${project.stack}) → ${project.command} ${project.args.join(' ')}`.trim());
  }

  if (options.dryRun) {
    console.log('\n🔍 Dry run complete. No tests were executed.\n');
    process.exit(0);
  }

  console.log(`\nMax iterations per project: ${Number(options.maxIterations)}`);
  if (options.fixScript) console.log(`Fixer: ${options.fixScript}`);

  const report = runHealLoop({
    projects,
    maxIterations: Number(options.maxIterations),
    fixScript: options.fixScript,
  });

  for (const project of report.projects) {
    if (project.passed) {
      console.log(`\n✅ ${project.root}: tests passed after ${project.attempts} attempt(s).`);
      continue;
    }
    console.log(`\n❌ ${project.root}: failed after ${project.attempts} attempt(s).`);
    console.log('------------------------------------------------------');
    console.log('📋 Diagnostic Failure Report:');
    console.log('------------------------------------------------------');
    console.log(project.diagnostics || 'No diagnostics captured.');
    console.log('------------------------------------------------------');
  }

  if (report.passed) {
    console.log('\n✅ All detected test projects passed.\n');
    process.exit(0);
  }

  const incidentPath = writeIncidentPackage(report);
  console.log(`\n💾 Saved diagnostic incident package to "${incidentPath}".`);
  console.log('🤖 Coding agents can read this package and apply a targeted patch autonomously.\n');
  process.exit(1);
}

main();
