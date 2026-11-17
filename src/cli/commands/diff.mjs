/**
 * SkillForge CLI: Diff Command
 * Semantic Breaking Change & Impact Tracker with JSON support.
 */

import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printSection, printSuccess, colors } from '../ui.mjs';
import { analyzeDiff } from '../../core/breaking-changes.mjs';

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
  const { report, changedFiles, affectedCallers, classifications, highestSeverity } = analyzeDiff(options);

  if (isJson || outFile) {
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
