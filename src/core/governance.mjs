/**
 * Human-in-the-Loop (HITL) governance helpers.
 *
 * Provides reviewer identity checks, automated/agent-identity detection, and
 * Git commit signature/author inspection used to verify that a sign-off was
 * produced by an authorized, non-agent human rather than self-approved by an AI
 * coding agent.
 */

import { execFileSync } from 'node:child_process';

/** Identity patterns that indicate an automated/agent/bot committer. */
export const AGENT_IDENTITY_PATTERNS = [
  /\[bot\]@/i,
  /\bgithub-actions\b/i,
  /\bcopilot\b/i,
  /\bopencode\b/i,
  /\bclaude\b/i,
  /\bbot@/i,
  /-bot\b/i,
  /\bcursor\b/i,
  /\bdevin\b/i,
  /\baider\b/i,
  /\bgemini\b/i,
  /\bcodex\b/i,
  /\banthropic\b/i,
  /\bwindsurf\b/i,
  /\bcontinue\b/i,
  /\bcline\b/i,
  /\broo\b/i,
  /\baugment\b/i,
  /\bsweep\b/i,
  /\bopenhands\b/i,
  /\brefact\b/i,
  /\btabnine\b/i,
];

/**
 * Heuristic: does this email belong to an automated/agent identity?
 * @param {string} email
 */
export function isAgentIdentity(email) {
  if (!email) return false;
  return AGENT_IDENTITY_PATTERNS.some((re) => re.test(email));
}

/**
 * Is the reviewer email explicitly allow-listed?
 * @param {string} email
 * @param {string[]} allowedReviewers
 */
export function isAllowedReviewer(email, allowedReviewers = []) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return allowedReviewers.map((e) => String(e).trim().toLowerCase()).includes(normalized);
}

/**
 * Default Git runner (argument array, no shell).
 * @returns {(args: string[]) => string}
 */
export function makeGitRunner() {
  return (args) => execFileSync('git', args, { encoding: 'utf-8' }).trim();
}

/**
 * Inspect the most recent commit that touched a path.
 * @param {string} filePath
 * @param {(args: string[]) => string} [runGit]
 * @returns {{hash: string, authorEmail: string, signature: string, committedAt: string, signer: string} | null}
 */
export function getSignoffCommitInfo(filePath, runGit = makeGitRunner()) {
  try {
    const out = runGit(['log', '-1', '--format=%H|%ae|%G?|%cI|%GS', '--', filePath]);
    if (!out) return null;
    const [hash, authorEmail, signature, committedAt, signer] = out.split('|');
    if (!hash) return null;
    return {
      hash,
      authorEmail,
      signature: signature || 'N',
      committedAt,
      signer: signer || '',
    };
  } catch {
    return null;
  }
}

/**
 * Has the sign-off exceeded its configured time-to-live?
 * @param {string} committedAtIso
 * @param {number} ttlDays
 */
export function isExpired(committedAtIso, ttlDays) {
  if (!ttlDays || ttlDays <= 0) return false;
  const t = Date.parse(committedAtIso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t > ttlDays * 24 * 60 * 60 * 1000;
}
