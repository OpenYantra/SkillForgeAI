#!/usr/bin/env node
/**
 * SkillForgeAI: Semantic Breaking Change & Change Impact Tracker
 * Analyzes Git diff against the code graph:
 * 1. Identifies modified files and traces downstream dependents.
 * 2. Classifies changes into:
 *    - DESTRUCTIVE (Breaking / MAJOR SemVer): Removed endpoints, deleted interface methods, altered types.
 *    - ADDITIVE (Non-Breaking / MINOR SemVer): New endpoints, new optional fields, new ports.
 *    - PATCH (Internal Implementation): Internal service logic, refactors, test fixes.
 * 3. Provides an automated Semantic Version bump recommendation.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function getGitChangedFiles() {
  try {
    const diffOutput = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    const stagedOutput = execSync('git diff --name-only --cached', { encoding: 'utf-8' });
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' });
    const all = [...diffOutput.split('\n'), ...stagedOutput.split('\n'), ...untracked.split('\n')]
      .map((f) => f.trim().replace(/\\/g, '/'))
      .filter((f) => f.length > 0);
    return [...new Set(all)];
  } catch {
    return [];
  }
}

function getDiffForFile(file) {
  try {
    return execSync(`git diff -U0 HEAD -- "${file}"`, { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

function classifyChanges(changedFiles) {
  let highestSeverity = 'PATCH'; // Default to PATCH
  const classifications = {
    destructive: [],
    additive: [],
    patch: [],
  };

  for (const file of changedFiles) {
    const isInterfaceOrPort = /ports?[\\/]|repository\.(ts|cs|go|py)|interfaces?[\\/]/i.test(file);
    const isContract = /openapi\.(yaml|json)|schema\.(json|yaml)|contracts?[\\/]/i.test(file);

    if (isInterfaceOrPort || isContract) {
      const diff = getDiffForFile(file);
      const lines = diff.split('\n');

      // Check for removed lines (starting with '-' but not '---')
      const removedLines = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));
      const addedLines = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));

      if (removedLines.length > 0) {
        // High likelihood of signature deletion or route mutation
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

function analyzeImpact() {
  console.log('\n======================================================');
  console.log('⚡ SkillForgeAI: Semantic Breaking Change & Impact Tracker');
  console.log('======================================================\n');

  const changedFiles = getGitChangedFiles();
  const graphPath = path.join('docs', 'context', 'code-graph.json');

  if (changedFiles.length === 0) {
    console.log('✅ Working tree clean. No uncommitted changes detected.');
    process.exit(0);
  }

  console.log(`Detected ${changedFiles.length} modified / new file(s):`);
  changedFiles.forEach((f) => console.log(`   📝 ${f}`));

  let graph = { nodes: {} };
  if (fs.existsSync(graphPath)) {
    graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  }

  const affectedCallers = new Set();
  for (const file of changedFiles) {
    if (graph.nodes[file]) {
      const callers = graph.nodes[file].importedBy || [];
      callers.forEach((c) => affectedCallers.add(c));
    }
  }

  const { classifications, highestSeverity } = classifyChanges(changedFiles);

  console.log('\n------------------------------------------------------');
  console.log('📊 Downstream Impact Matrix:');
  console.log('------------------------------------------------------');
  if (affectedCallers.size > 0) {
    console.log('The following downstream files are affected and require testing:');
    affectedCallers.forEach((caller) => console.log(`   ⚠️  ${caller}`));
  } else {
    console.log('No registered downstream dependencies affected.');
  }

  console.log('\n------------------------------------------------------');
  console.log('🏷️  Semantic Change Classification:');
  console.log('------------------------------------------------------');

  if (classifications.destructive.length > 0) {
    console.log('🚨 DESTRUCTIVE (Breaking Changes):');
    classifications.destructive.forEach((d) => console.log(`   💥 [MAJOR] ${d.file} — ${d.reason}`));
  }

  if (classifications.additive.length > 0) {
    console.log('✨ ADDITIVE (Backward-Compatible Changes):');
    classifications.additive.forEach((a) => console.log(`   🌱 [MINOR] ${a.file} — ${a.reason}`));
  }

  if (classifications.destructive.length === 0 && classifications.additive.length === 0) {
    console.log('🩹 PATCH: All changes are internal implementations or test suites.');
  }

  console.log('\n------------------------------------------------------');
  console.log(`📌 Recommended SemVer Bump: ${highestSeverity}`);
  console.log('------------------------------------------------------\n');
}

analyzeImpact();
