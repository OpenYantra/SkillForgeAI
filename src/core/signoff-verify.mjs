/**
 * SkillForgeAI: Human-in-the-Loop (HITL) Sign-Off Gate (core engine)
 *
 * Ensures AI coding agents cannot authorise implementation or production
 * deployment on their own. In `project` mode a sign-off is only valid when:
 *   1. The document is structurally complete (APPROVED + authorisation).
 *   2. The commit that introduced it is signed and authored by an allow-listed
 *      human reviewer (not a bot/agent identity).
 *   3. The recorded artifact hash matches the sign-off commit.
 *   4. The sign-off has not exceeded its configured TTL.
 *
 * In `self-test` mode the identity/signature checks are skipped and a clear
 * WARNING is emitted, so framework example artifacts remain verifiable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadGateConfig } from './gate-registry.mjs';
import { getSignoffCommitInfo, isAllowedReviewer, isAgentIdentity, isExpired } from './governance.mjs';

/**
 * @param {string} signOffPath
 * @param {{config?: object, configPath?: string, selfTest?: boolean, runGit?: (args: string[]) => string, silent?: boolean}} [options]
 */
export function verifySignOff(signOffPath, options = {}) {
  const emit = options.silent ? () => {} : (...args) => console.log(...args);
  const errors = [];
  const warnings = [];

  if (!signOffPath) {
    errors.push('Please specify a sign-off document path. Usage: verify-human-signoff.mjs <path-to-sign-off.md>');
    printReport(signOffPath, errors, warnings, {}, emit);
    return { passed: false, errors, warnings };
  }

  const resolved = path.resolve(signOffPath);
  if (!fs.existsSync(resolved)) {
    errors.push(
      `Sign-off file not found at "${resolved}". To create one, copy templates/phase-signoff-template.md to docs/approvals/.`,
    );
    printReport(signOffPath, errors, warnings, {}, emit);
    return { passed: false, errors, warnings };
  }

  const content = fs.readFileSync(resolved, 'utf-8');

  // --- Structural checks ---------------------------------------------------
  const statusMatch = content.match(/\*{0,2}Status:\*{0,2}\s*([^\n\r]+)/i);
  const statusText = statusMatch ? statusMatch[1].trim() : '';
  if (!/\bAPPROVED\b/i.test(statusText)) {
    errors.push(`Human sign-off status is not APPROVED (found "${statusText || 'None'}").`);
  }

  const reviewerMatch = content.match(/\*{0,2}Reviewed By \(Human\):\*{0,2}\s*([^\n\r]+)/i);
  const reviewerText = reviewerMatch ? reviewerMatch[1].replace(/^\*+|\*+$/g, '').trim() : '';
  if (!reviewerText || reviewerText.includes('[')) {
    errors.push('Reviewed By (Human) is missing or contains placeholder text. A verified human name is required.');
  }

  const dateMatch = content.match(/\*{0,2}Approval Date:\*{0,2}\s*(\d{4}-\d{2}-\d{2})/i);
  if (!dateMatch) {
    warnings.push('Approval date is missing or not in YYYY-MM-DD format.');
  }

  const hashMatch = content.match(/\*{0,2}Commit \/ Artifact Hash:\*{0,2}\s*([A-Fa-f0-9]{6,40})/i);
  const recordedHash = hashMatch ? hashMatch[1] : '';

  const hasAuthorization = /\[x\]\s*Authorized to proceed/i.test(content);
  if (!hasAuthorization) {
    errors.push('Missing explicit authorization checkbox: "[x] Authorized to proceed".');
  }

  // --- Governance checks (project mode only) -------------------------------
  let config = options.config;
  if (!config) {
    try {
      config = loadGateConfig(options.configPath);
    } catch (err) {
      config = { mode: 'self-test', governance: {} };
      warnings.push(`Could not load gate config (${err.message}); falling back to self-test governance checks.`);
    }
  }

  const selfTest = options.selfTest != null ? options.selfTest : config.mode !== 'project';
  const gov = config.governance || {};
  const summary = {
    reviewer: reviewerText,
    date: dateMatch ? dateMatch[1] : '',
    mode: selfTest ? 'self-test' : 'project',
  };

  if (selfTest) {
    warnings.push(
      'Self-test mode: HITL signature/identity checks are skipped (demo attestation, not production-valid).',
    );
  } else {
    const info = getSignoffCommitInfo(resolved, options.runGit);

    if (!info) {
      errors.push('Could not determine the Git commit that introduced this sign-off (is this a Git repository?).');
    } else {
      summary.reviewer = info.authorEmail || reviewerText;
      summary.commit = info.hash;
      summary.signature = info.signature;

      if (!isAllowedReviewer(info.authorEmail, gov.allowedReviewers || [])) {
        errors.push(`Sign-off commit author "${info.authorEmail || 'unknown'}" is not in governance.allowedReviewers.`);
      }

      if (gov.allowAgentIdentities !== true && isAgentIdentity(info.authorEmail)) {
        errors.push(
          `Sign-off commit author "${info.authorEmail}" looks like an automated/agent identity. A human reviewer is required.`,
        );
      }

      if (gov.requireSignedCommits === true && info.signature !== 'G') {
        errors.push(
          `Sign-off commit is not a validly signed commit (git signature status: "${info.signature || 'N'}"). Use "git commit -S".`,
        );
      }

      if (recordedHash && !info.hash.startsWith(recordedHash) && !recordedHash.startsWith(info.hash)) {
        errors.push(
          `Recorded Commit/Artifact Hash "${recordedHash}" does not match the sign-off commit "${info.hash}".`,
        );
      }

      if (isExpired(info.committedAt, gov.signoffTtlDays)) {
        errors.push(`Sign-off is older than the configured TTL of ${gov.signoffTtlDays} day(s) and must be renewed.`);
      }
    }
  }

  printReport(resolved, errors, warnings, summary, emit);
  return { passed: errors.length === 0, errors, warnings };
}

function printReport(target, errors, warnings, summary = {}, emit = console.log) {
  emit('\n======================================================');
  emit('👤 SkillForgeAI: Human-in-the-Loop (HITL) Governance Gate');
  emit('======================================================\n');
  if (target) emit(`Evaluating Sign-off Document: ${path.basename(target)}`);
  emit(`Mode: ${summary.mode || 'self-test'}`);
  if (summary.reviewer) emit(`Reviewer: ${summary.reviewer}`);
  if (summary.date) emit(`Date: ${summary.date}`);
  if (summary.commit) emit(`Commit: ${summary.commit} (signature: ${summary.signature || 'N'})`);

  if (warnings.length > 0) {
    emit('\n⚠️  WARNINGS:');
    warnings.forEach((w) => emit(`   - ${w}`));
  }

  if (errors.length > 0) {
    emit('\n❌ FAILED - Human Sign-Off Missing, Incomplete, or Unauthorized:');
    errors.forEach((e) => emit(`   - ${e}`));
    emit(
      '\n🛑 Agent Execution Halted: AI coding agents must not proceed to implementation without a verified human approval.\n',
    );
  } else {
    emit('\n✅ PASSED: Human-in-the-Loop sign-off verified!');
    emit('   AI Coding Agent is authorized to proceed to the next phase.\n');
  }
}
