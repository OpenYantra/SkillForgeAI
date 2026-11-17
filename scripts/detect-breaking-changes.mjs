#!/usr/bin/env node
/**
 * Script wrapper: semantic breaking change & impact tracker.
 * The engine lives in `src/core/breaking-changes.mjs`.
 */

import { analyzeDiff } from '../src/core/breaking-changes.mjs';

function main() {
  console.log('\n======================================================');
  console.log('⚡ SkillForgeAI: Semantic Breaking Change & Impact Tracker');
  console.log('======================================================\n');

  const { changedFiles, affectedCallers, classifications, highestSeverity } = analyzeDiff();

  if (changedFiles.length === 0) {
    console.log('✅ Working tree clean. No uncommitted changes detected.');
    process.exit(0);
  }

  console.log(`Detected ${changedFiles.length} modified / new file(s):`);
  changedFiles.forEach((f) => console.log(`   📝 ${f}`));

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

main();
