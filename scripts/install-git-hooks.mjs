#!/usr/bin/env node
/**
 * SkillForgeAI: Git Lifecycle Hook Installer
 * Installs pre-commit and pre-push hooks to enforce:
 * - Pre-commit: Change impact analysis & breaking change detection
 * - Pre-push: Master SDLC quality gate evaluation (all 7 phases)
 */

import fs from 'node:fs';
import path from 'node:path';

const GIT_DIR = '.git';
const HOOKS_DIR = path.join(GIT_DIR, 'hooks');

function installHooks() {
  console.log('\n======================================================');
  console.log('⚓ SkillForgeAI: Git Lifecycle Hook Installer');
  console.log('======================================================\n');

  if (!fs.existsSync(GIT_DIR)) {
    console.error('❌ Error: .git directory not found. Please run "git init" first.');
    process.exit(1);
  }

  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
  }

  // 1. Pre-Commit Hook (Breaking changes & impact check)
  const preCommitScript = `#!/bin/sh
# SkillForgeAI Pre-Commit Guard
echo ""
echo "🔍 [SkillForgeAI] Running pre-commit change impact check..."
node scripts/detect-breaking-changes.mjs
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ [SkillForgeAI] Pre-commit check failed! Please resolve breaking changes before committing."
  exit 1
fi
`;

  const preCommitPath = path.join(HOOKS_DIR, 'pre-commit');
  fs.writeFileSync(preCommitPath, preCommitScript, { mode: 0o755 });
  console.log(`   ✅ Installed Pre-Commit Hook: ${preCommitPath}`);

  // 2. Pre-Push Hook (Full SDLC Quality Gate Evaluation)
  const prePushScript = `#!/bin/sh
# SkillForgeAI Pre-Push Quality Gate
echo ""
echo "🛡️  [SkillForgeAI] Running full SDLC quality gates before push..."
node .agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ [SkillForgeAI] Pre-push gate failed! Cannot push with failing SDLC criteria."
  exit 1
fi
`;

  const prePushPath = path.join(HOOKS_DIR, 'pre-push');
  fs.writeFileSync(prePushPath, prePushScript, { mode: 0o755 });
  console.log(`   ✅ Installed Pre-Push Hook: ${prePushPath}`);

  console.log('\n🎉 Git lifecycle hooks successfully activated!');
  console.log('   - Commits will now automatically verify breaking changes.');
  console.log('   - Pushes will now automatically verify all 7 SDLC quality gates.\n');
}

installHooks();
