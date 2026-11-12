#!/usr/bin/env node
/**
 * SkillForgeAI: Breaking Change & Change Impact Tracker
 * Analyzes Git diff against the code graph:
 * 1. Identifies which files were changed.
 * 2. Traces downstream dependents in code-graph.json to find affected modules.
 * 3. Checks for breaking changes in domain interfaces (ports) and API contracts.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function getGitChangedFiles() {
  try {
    const diffOutput = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    const stagedOutput = execSync('git diff --name-only --cached', { encoding: 'utf-8' });
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' });
    const all = [
      ...diffOutput.split('\n'),
      ...stagedOutput.split('\n'),
      ...untracked.split('\n'),
    ]
      .map(f => f.trim().replace(/\\/g, '/'))
      .filter(f => f.length > 0);
    return [...new Set(all)];
  } catch (err) {
    return [];
  }
}

function analyzeImpact() {
  console.log('\n======================================================');
  console.log('⚡ SkillForgeAI: Change Impact & Breaking Change Tracker');
  console.log('======================================================\n');

  const changedFiles = getGitChangedFiles();
  const graphPath = path.join('docs', 'context', 'code-graph.json');

  if (changedFiles.length === 0) {
    console.log('✅ Working tree clean. No uncommitted changes detected.');
    process.exit(0);
  }

  console.log(`Detected ${changedFiles.length} modified / new file(s):`);
  changedFiles.forEach(f => console.log(`   📝 ${f}`));

  let graph = { nodes: {} };
  if (fs.existsSync(graphPath)) {
    graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
  }

  const affectedCallers = new Set();
  const breakingChanges = [];

  for (const file of changedFiles) {
    // 1. Trace Graph Impact
    if (graph.nodes[file]) {
      const callers = graph.nodes[file].importedBy || [];
      callers.forEach(c => affectedCallers.add(c));
    }

    // 2. Breaking Change Check: Domain Ports / Interfaces
    if (file.includes('ports/') || file.includes('repository.ts') || file.includes('contract')) {
      breakingChanges.push(`Potential Interface Mutation: "${file}". Ensure all implementing adapters and mocks are updated.`);
    }

    // 3. Breaking Change Check: OpenAPI contracts
    if (file.endsWith('.yaml') || file.endsWith('.json')) {
      if (file.includes('openapi') || file.includes('contract')) {
        breakingChanges.push(`API Contract Modified: "${file}". Check for deleted fields, changed types, or modified paths.`);
      }
    }
  }

  console.log('\n------------------------------------------------------');
  console.log('📊 Downstream Impact Matrix:');
  console.log('------------------------------------------------------');
  if (affectedCallers.size > 0) {
    console.log('The following downstream files are affected and require testing:');
    affectedCallers.forEach(caller => console.log(`   ⚠️  ${caller}`));
  } else {
    console.log('No registered downstream dependencies affected.');
  }

  if (breakingChanges.length > 0) {
    console.log('\n🚨 BREAKING CHANGE ALERTS:');
    breakingChanges.forEach(bc => console.log(`   💥 ${bc}`));
  } else {
    console.log('\n✅ No high-risk contract or port breaking changes detected.');
  }

  console.log('\nRun `node .agents/skills/quality-gate-orchestrator/scripts/run-all-gates.mjs` to verify integrity.\n');
}

analyzeImpact();
