/**
 * SkillForge CLI: Diff Command
 * Semantic Breaking Change & Impact Tracker with JSON support.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printSection, printSuccess, colors } from '../ui.mjs';

function getGitChangedFiles(options = {}) {
  try {
    let diffCmd = 'git diff --name-only HEAD';
    if (options.staged) {
      diffCmd = 'git diff --name-only --cached';
    } else if (options.target) {
      diffCmd = `git diff --name-only origin/${options.target}...HEAD || git diff --name-only ${options.target}...HEAD`;
    }

    const diffOutput = execSync(diffCmd, { encoding: 'utf-8' });
    const stagedOutput = options.staged ? '' : execSync('git diff --name-only --cached', { encoding: 'utf-8' });
    const untracked = options.staged ? '' : execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' });

    const all = [...diffOutput.split('\n'), ...stagedOutput.split('\n'), ...untracked.split('\n')]
      .map((f) => f.trim().replace(/\\/g, '/'))
      .filter((f) => f.length > 0);
    return [...new Set(all)];
  } catch {
    return [];
  }
}

function getDiffForFile(file, options = {}) {
  try {
    const base = options.target ? `${options.target}...HEAD` : 'HEAD';
    return execSync(`git diff -U0 ${base} -- "${file}"`, { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

function classifyChanges(changedFiles, options = {}) {
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

export function executeDiff(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge diff [options]

Options:
  --staged          Inspect only staged Git changes
  --target <branch> Compare against a specific target branch (e.g. main, develop)
  --json            Emit machine-readable JSON (ideal for CI PR scorecards)
  --out <file>      Write JSON output directly to a file
  --help, -h        Show this help message

Examples:
  skillforge diff
  skillforge diff --staged
  skillforge diff --target main --json
  skillforge diff --out diff-report.json
`);
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const isStaged = args.includes('--staged');
  const targetIndex = args.indexOf('--target');
  const targetBranch = targetIndex !== -1 ? args[targetIndex + 1] : null;
  const outIndex = args.indexOf('--out');
  const outFile = outIndex !== -1 ? args[outIndex + 1] : null;

  const options = { staged: isStaged, target: targetBranch };
  const changedFiles = getGitChangedFiles(options);

  const graphPath = path.join('docs', 'context', 'code-graph.json');
  let graph = { nodes: {} };
  if (fs.existsSync(graphPath)) {
    try {
      graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    } catch {}
  }

  const affectedCallers = new Set();
  for (const file of changedFiles) {
    if (graph.nodes[file]) {
      const callers = graph.nodes[file].importedBy || [];
      callers.forEach((c) => affectedCallers.add(c));
    }
  }

  const { classifications, highestSeverity } = classifyChanges(changedFiles, options);

  if (isJson || outFile) {
    const report = {
      timestamp: new Date().toISOString(),
      target: targetBranch || 'HEAD',
      totalChangedFiles: changedFiles.length,
      changedFiles,
      affectedCallers: [...affectedCallers],
      highestSeverity,
      classifications,
    };
    const jsonStr = JSON.stringify(report, null, 2);
    if (outFile) {
      const dir = path.dirname(outFile);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outFile, jsonStr);
    }
    if (isJson || !outFile) {
      console.log(jsonStr);
    }
    process.exit(0);
  }

  printBanner('⚡ SkillForgeAI: Semantic Breaking Change & Impact Tracker');

  if (changedFiles.length === 0) {
    printSuccess('Working tree clean. No uncommitted or modified changes detected.\n');
    process.exit(0);
  }

  console.log(`Detected ${colors.bold}${changedFiles.length}${colors.reset} modified / new file(s):`);
  changedFiles.forEach((f) => console.log(`   📝 ${f}`));

  printSection('Downstream Impact Matrix');
  if (affectedCallers.size > 0) {
    console.log('The following downstream files are affected and require testing:');
    affectedCallers.forEach((caller) => console.log(`   ⚠️  ${colors.yellow}${caller}${colors.reset}`));
  } else {
    console.log('No registered downstream dependencies affected.');
  }

  printSection('Semantic Change Classification');
  if (classifications.destructive.length > 0) {
    console.log(`${colors.red}${colors.bold}🚨 DESTRUCTIVE (Breaking Changes):${colors.reset}`);
    classifications.destructive.forEach((d) => console.log(`   💥 [MAJOR] ${d.file} — ${d.reason}`));
  }

  if (classifications.additive.length > 0) {
    console.log(`${colors.green}${colors.bold}✨ ADDITIVE (Backward-Compatible Changes):${colors.reset}`);
    classifications.additive.forEach((a) => console.log(`   🌱 [MINOR] ${a.file} — ${a.reason}`));
  }

  if (classifications.destructive.length === 0 && classifications.additive.length === 0) {
    console.log('🩹 PATCH: All changes are internal implementations or test suites.');
  }

  printSection(`Recommended SemVer Bump: ${colors.bold}${highestSeverity}${colors.reset}\n`);
}
