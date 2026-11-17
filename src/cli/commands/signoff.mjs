/**
 * SkillForge CLI: Signoff Command
 * Generates Human-in-the-Loop (HITL) review drafts and verifies approved,
 * signed attestations. Drafts are always PENDING_REVIEW — the CLI never
 * produces an APPROVED verdict on its own.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printError, printWarning, colors } from '../ui.mjs';

function getCurrentGitSha() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim();
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
  --by "<Name>"         Human reviewer name (Required for draft generation)
  --role "<Role>"       Reviewer role (e.g. Lead Architect, Tech Lead)
  --feature "<Feature>" Feature or service name being approved (Required)
  --verify <path>       Verify an existing approved sign-off file
  --config <file>       Gate config used during verification (default: skillforge.config.json)
  --help, -h            Show this help message

Workflow:
  "signoff" only creates a PENDING_REVIEW draft. A human reviewer must set the
  status to APPROVED, check the authorisation boxes, and commit it with a signed
  commit ("git commit -S"). Then run "signoff --verify <path>" to validate it.

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
    const configIndex = args.indexOf('--config');
    const configPath = configIndex !== -1 ? args[configIndex + 1] : undefined;
    try {
      const cmdArgs = [path.resolve('scripts/verify-human-signoff.mjs'), targetFile];
      if (configPath) cmdArgs.push(configPath);
      execFileSync(process.execPath, cmdArgs, { stdio: 'inherit' });
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }

  // Draft generation mode
  const byIndex = args.indexOf('--by');
  const roleIndex = args.indexOf('--role');
  const featureIndex = args.indexOf('--feature');
  const phaseIndex = args.indexOf('--phase');

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
  const gitSha = getCurrentGitSha();
  const today = new Date().toISOString().split('T')[0];

  const targetDir = path.join('docs', 'approvals');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const fileName = `${feature.toLowerCase().replace(/[^a-z0-9_-]/g, '')}-signoff.md`;
  const filePath = path.join(targetDir, fileName);

  const content = `# SDLC Phase Sign-Off: ${feature}

- **Target Phase:** Phase ${phase}
- **Status:** PENDING_REVIEW
- **Reviewed By (Human):** ${humanName}
- **Reviewer Role:** ${role}
- **Approval Date:** ${today}
- **Commit / Artifact Hash:** ${gitSha}

---

## 1. Review Checklist & Verification
- [ ] Scope and non-goals are clearly bounded.
- [ ] Edge cases and failure modes are explicitly specified.
- [ ] Security, auth, and data privacy boundaries are satisfied.
- [ ] Architecture respects Clean Architecture and dependency inversion.
- [ ] All automated validation scripts passed with 0 errors.

---

## 2. Reviewer Notes & Approvals
> This is a DRAFT generated for human review. A human reviewer must set the status
> to APPROVED, check the boxes below, and commit with a signed commit
> (\`git commit -S\`). The verification gate rejects unsigned or agent-authored sign-offs.

**Authorized Next Phase:**
- [ ] Authorized to proceed to **Phase 4: Feature Scaffolding & Implementation**
- [ ] Authorized for **Phase 6: Production Deployment**
`;

  fs.writeFileSync(filePath, content);

  printBanner('👤 SkillForgeAI: Human-in-the-Loop Sign-Off Draft Generator');
  printWarning('Generated a PENDING_REVIEW draft. This is NOT an approval.');
  console.log(`\nDraft file: ${colors.cyan}${filePath}${colors.reset}`);
  console.log(`Reviewer: ${colors.bold}${humanName}${colors.reset} (${role})`);
  console.log(`Feature: ${colors.bold}${feature}${colors.reset}`);
  console.log(`Commit SHA: ${colors.cyan}${gitSha}${colors.reset}\n`);
  console.log('Next steps:');
  console.log('  1. A human reviewer sets "Status: APPROVED" and checks the authorisation boxes.');
  console.log('  2. Commit the sign-off with a signed commit:');
  console.log(`       git commit -S -m "signoff: approve ${feature}" ${filePath}`);
  console.log(`  3. Verify: node bin/skillforge.mjs signoff --verify "${filePath}"\n`);
}
