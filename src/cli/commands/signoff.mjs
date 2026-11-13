/**
 * SkillForge CLI: Signoff Command
 * Automates Human-in-the-Loop (HITL) approval documentation and verification.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printSuccess, printError, colors } from '../ui.mjs';

function getCurrentGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'local-draft';
  }
}

export function executeSignoff(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge signoff [options]

Options:
  --phase <2|3|6>       SDLC phase to sign off (default: 3)
  --by "<Name>"         Verified human reviewer name (Required)
  --role "<Role>"       Reviewer role (e.g. Lead Architect, Tech Lead)
  --feature "<Feature>" Feature or service name being approved (Required)
  --status <status>     Sign-off status: APPROVED or REJECTED (default: APPROVED)
  --verify <path>       Verify an existing sign-off file without generating new
  --help, -h            Show this help message

Examples:
  skillforge signoff --feature "order-service" --by "Rishikesh Kumar" --role "Lead Architect"
  skillforge signoff --verify docs/approvals/order-service-signoff.md
`);
    process.exit(0);
  }

  // Verification mode
  const verifyIndex = args.indexOf('--verify');
  if (verifyIndex !== -1) {
    const targetFile = args[verifyIndex + 1];
    if (!targetFile) {
      printError('Missing path for --verify <path>');
      process.exit(2);
    }
    try {
      execSync(`node scripts/verify-human-signoff.mjs "${targetFile}"`, { stdio: 'inherit' });
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  }

  // Generation mode
  const byIndex = args.indexOf('--by');
  const roleIndex = args.indexOf('--role');
  const featureIndex = args.indexOf('--feature');
  const phaseIndex = args.indexOf('--phase');
  const statusIndex = args.indexOf('--status');

  if (byIndex === -1 || !args[byIndex + 1]) {
    printError('Missing required parameter: --by "<Human Name>"');
    process.exit(2);
  }

  if (featureIndex === -1 || !args[featureIndex + 1]) {
    printError('Missing required parameter: --feature "<Feature Name>"');
    process.exit(2);
  }

  const humanName = args[byIndex + 1].trim();
  const feature = args[featureIndex + 1].trim();
  const role = roleIndex !== -1 ? args[roleIndex + 1].trim() : 'Technical Lead';
  const phase = phaseIndex !== -1 ? args[phaseIndex + 1] : '3';
  const status = (statusIndex !== -1 ? args[statusIndex + 1] : 'APPROVED').toUpperCase();
  const gitSha = getCurrentGitSha();
  const today = new Date().toISOString().split('T')[0];

  const targetDir = path.join('docs', 'approvals');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const fileName = `${feature.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-signoff.md`;
  const filePath = path.join(targetDir, fileName);

  const content = `# SDLC Phase Sign-Off: ${feature}

- **Target Phase:** Phase ${phase}
- **Status:** ${status}
- **Reviewed By (Human):** ${humanName}
- **Reviewer Role:** ${role}
- **Approval Date:** ${today}
- **Commit / Artifact Hash:** ${gitSha}

---

## 1. Review Checklist & Verification
- [x] Scope and non-goals are clearly bounded.
- [x] Edge cases and failure modes are explicitly specified.
- [x] Security, auth, and data privacy boundaries are satisfied.
- [x] Architecture respects Clean Architecture and dependency inversion.
- [x] All automated validation scripts passed with 0 errors.

---

## 2. Reviewer Notes & Approvals
The requirements and architectural boundaries for "${feature}" have been formally reviewed and approved.

**Authorized Next Phase:**
- [x] Authorized to proceed to **Phase 4: Feature Scaffolding & Implementation**
- [ ] Authorized for **Phase 6: Production Deployment**
`;

  fs.writeFileSync(filePath, content);

  printBanner('👤 SkillForgeAI: Human-in-the-Loop Sign-Off Generator');
  printSuccess(`Generated approved human sign-off document at: ${filePath}`);
  console.log(`\nReviewer: ${colors.bold}${humanName}${colors.reset} (${role})`);
  console.log(`Feature: ${colors.bold}${feature}${colors.reset}`);
  console.log(`Commit SHA: ${colors.cyan}${gitSha}${colors.reset}\n`);

  // Auto-verify with the sign-off validator
  try {
    execSync(`node scripts/verify-human-signoff.mjs "${filePath}"`, { stdio: 'inherit' });
  } catch (err) {
    printError('Generated file failed self-verification!');
    process.exit(1);
  }
}
