/**
 * SkillForgeAI: Human-in-the-Loop (HITL) Sign-Off Gate (core engine)
 *
 * Ensures AI coding agents cannot authorise implementation or production
 * deployment on their own. In `project` mode a sign-off is only valid when:
 *   1. The document is structurally complete (APPROVED + authorisation).
 *   2. The committed blob matches the working-tree document (no uncommitted edits).
 *   3. The commit was authored by an allow-listed human and, when signed, the
 *      signing identity is allow-listed.
 *   4. The approved artifacts still match their recorded SHA-256 hashes.
 *   5. The approval date has not exceeded its configured TTL.
 *
 * In `self-test` mode the identity/signature/artifact checks are skipped and a
 * machine-readable `demo: true` is returned.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadGateConfig } from './gate-registry.mjs';
import { getSignoffCommitInfo, isAllowedReviewer, isAgentIdentity, makeGitRunner } from './governance.mjs';
import { stripFencedCode } from './markdown.mjs';

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
    return { passed: false, errors, warnings, demo: false };
  }

  const resolved = path.resolve(signOffPath);
  if (!fs.existsSync(resolved)) {
    errors.push(
      `Sign-off file not found at "${resolved}". To create one, copy templates/phase-signoff-template.md to docs/approvals/.`,
    );
    printReport(signOffPath, errors, warnings, {}, emit);
    return { passed: false, errors, warnings, demo: false };
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  // Fenced examples are documentation, not attestations.
  const document = stripFencedCode(content);

  // --- Structural checks ---------------------------------------------------
  const statusMatch = document.match(/\*{0,2}Status:\*{0,2}\s*([^\n\r]+)/i);
  const statusText = statusMatch ? statusMatch[1].trim() : '';
  if (!/\bAPPROVED\b/i.test(statusText)) {
    errors.push(`Human sign-off status is not APPROVED (found "${statusText || 'None'}").`);
  }

  const reviewerMatch = document.match(/\*{0,2}Reviewed By \(Human\):\*{0,2}\s*([^\n\r]+)/i);
  const reviewerText = reviewerMatch ? reviewerMatch[1].replace(/^\*+|\*+$/g, '').trim() : '';
  if (!reviewerText || reviewerText.includes('[')) {
    errors.push('Reviewed By (Human) is missing or contains placeholder text. A verified human name is required.');
  }

  const dateMatch = document.match(/\*{0,2}Approval Date:\*{0,2}\s*(\d{4}-\d{2}-\d{2})/i);
  if (!dateMatch) {
    warnings.push('Approval date is missing or not in YYYY-MM-DD format.');
  }

  const hashMatch = document.match(/\*{0,2}Commit \/ Artifact Hash:\*{0,2}\s*([A-Fa-f0-9]{6,40})/i);
  const recordedHash = hashMatch ? hashMatch[1] : '';

  const hasAuthorization = /\[x\]\s*Authorized to proceed/i.test(document);
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
    demo: selfTest,
  };

  if (selfTest) {
    warnings.push('Self-test mode: HITL identity, signature and artifact checks are skipped (demo attestation).');
  } else {
    const runGit = options.runGit || makeGitRunner();

    if (isWorkingTreeDirty(resolved, runGit)) {
      errors.push('Sign-off has uncommitted changes. Commit the approved version before running the gate.');
    }

    const info = getSignoffCommitInfo(resolved, runGit);

    if (!info) {
      errors.push('Could not determine the Git commit that introduced this sign-off (is this a Git repository?).');
    } else {
      summary.reviewer = info.authorEmail || reviewerText;
      summary.commit = info.hash;
      summary.signature = info.signature;
      summary.signer = info.signer;

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

      if (Array.isArray(gov.allowedKeys) && gov.allowedKeys.length > 0) {
        const allowed = gov.allowedKeys.map((key) => String(key).trim().toLowerCase());
        if (!info.signer || !allowed.includes(info.signer.trim().toLowerCase())) {
          errors.push(`Sign-off signer "${info.signer || 'unknown'}" is not in governance.allowedKeys.`);
        }
      } else if (
        info.signer &&
        info.signer.includes('@') &&
        !isAllowedReviewer(info.signer, gov.allowedReviewers || [])
      ) {
        errors.push(`Sign-off signer "${info.signer}" is not in governance.allowedReviewers.`);
      }

      if (recordedHash && !info.hash.startsWith(recordedHash) && !recordedHash.startsWith(info.hash)) {
        errors.push(
          `Recorded Commit/Artifact Hash "${recordedHash}" does not match the sign-off commit "${info.hash}".`,
        );
      }
    }

    if (gov.signoffTtlDays) {
      if (!dateMatch) {
        errors.push('Approval date is required when governance.signoffTtlDays is configured.');
      } else {
        const approvedAt = Date.parse(`${dateMatch[1]}T00:00:00Z`);
        if (Number.isNaN(approvedAt)) {
          errors.push(`Approval date "${dateMatch[1]}" is not a valid YYYY-MM-DD date.`);
        } else if (Date.now() - approvedAt > gov.signoffTtlDays * 24 * 60 * 60 * 1000) {
          errors.push(
            `Sign-off is older than the configured TTL of ${gov.signoffTtlDays} day(s) from its approval date and must be renewed.`,
          );
        }
      }
    }

    checkArtifacts(document, resolved, errors);
  }

  printReport(resolved, errors, warnings, summary, emit);
  return { passed: errors.length === 0, errors, warnings, demo: selfTest };
}

function isWorkingTreeDirty(filePath, runGit) {
  try {
    const status = runGit(['status', '--porcelain', '--', filePath]);
    return /^\s{0,2}[ MADRCU?!]{1,2}\s/.test(status);
  } catch {
    return false;
  }
}

function resolveArtifactPath(rawPath, signoffPath) {
  const candidates = [path.resolve(rawPath), path.resolve(path.dirname(signoffPath), rawPath)];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function checkArtifacts(document, signoffPath, errors) {
  const artifactPath = document.match(/\*{0,2}Artifact Path:\*{0,2}\s*([^\n\r]+)/i);
  const artifactHash = document.match(/\*{0,2}Artifact Hash:\*{0,2}\s*([a-f0-9]{64})/i);

  if (!artifactPath || !artifactHash) {
    errors.push(
      'Approval must bind to at least one artifact: add "- **Artifact Path:** <path>" and "- **Artifact Hash:** <sha256>".',
    );
    return;
  }

  const declaredPath = artifactPath[1].replace(/^\*+|\*+$/g, '').trim();
  const expected = artifactHash[1].toLowerCase();
  const artifactFile = resolveArtifactPath(declaredPath, signoffPath);

  if (!artifactFile) {
    errors.push(`Approved artifact not found at "${declaredPath}".`);
    return;
  }

  const actual = crypto.createHash('sha256').update(fs.readFileSync(artifactFile)).digest('hex');
  if (actual !== expected) {
    errors.push(`Approved artifact "${declaredPath}" changed after approval (SHA-256 mismatch).`);
  }
}

function printReport(target, errors, warnings, summary = {}, emit = console.log) {
  emit('\n======================================================');
  emit('👤 SkillForgeAI: Human-in-the-Loop (HITL) Governance Gate');
  emit('======================================================\n');
  if (target) emit(`Evaluating Sign-off Document: ${path.basename(target)}`);
  emit(`Mode: ${summary.mode || 'self-test'}${summary.demo ? ' (demo)' : ''}`);
  if (summary.reviewer) emit(`Reviewer: ${summary.reviewer}`);
  if (summary.date) emit(`Date: ${summary.date}`);
  if (summary.commit) emit(`Commit: ${summary.commit} (signature: ${summary.signature || 'N'})`);
  if (summary.signer) emit(`Signer: ${summary.signer}`);

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
    if (summary.demo) {
      emit('   Demo attestation only: this is not a production authorization.\n');
    } else {
      emit('   AI Coding Agent is authorized to proceed to the next phase.\n');
    }
  }
}
