#!/usr/bin/env node
/**
 * SkillForgeAI: PR Scorecard Synthesizer
 * Merges gate-report.json and diff-report.json into an interactive,
 * GitHub-flavored Markdown scorecard for PR comments and Step Summaries.
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const diffIndex = args.indexOf('--diff');
  const gateIndex = args.indexOf('--gate');
  const outIndex = args.indexOf('--out');

  return {
    diffFile: diffIndex !== -1 ? args[diffIndex + 1] : 'diff-report.json',
    gateFile: gateIndex !== -1 ? args[gateIndex + 1] : 'gate-report.json',
    outFile: outIndex !== -1 ? args[outIndex + 1] : null,
  };
}

function loadJson(filePath, fallback = {}, errors = [], label = path.basename(filePath)) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      errors.push(`${label} is not valid JSON (${err.message}); treating it as missing.`);
      return fallback;
    }
  }
  return fallback;
}

export function generateScorecard(diffReport, gateReport, errors = []) {
  const gateStatus = (gateReport && gateReport.status) || 'MISSING';
  const isPassed = gateStatus === 'PASSED';
  const isMissing = gateStatus === 'MISSING' || gateStatus === 'UNKNOWN';
  const statusEmoji = isPassed ? '✅' : '🚨';
  const totalGates =
    gateReport && gateReport.totalGates != null
      ? gateReport.totalGates
      : gateReport && gateReport.gates
        ? gateReport.gates.length
        : 0;
  const statusBadge = isPassed
    ? `**ALL ${totalGates} SDLC QUALITY GATES PASSED**`
    : isMissing
      ? '**GATE REPORT MISSING — CANNOT CERTIFY**'
      : '**ONE OR MORE SDLC GATES FAILED**';

  const semver = diffReport.highestSeverity || 'PATCH';
  const totalChanged = diffReport.totalChangedFiles ?? (diffReport.changedFiles ? diffReport.changedFiles.length : 0);
  const callers = diffReport.affectedCallers || [];

  let md = `<!-- skillforge-pr-scorecard -->\n`;
  md += `## 🛡️ SkillForgeAI Quality Gate Report\n\n`;
  md += `> **Status:** ${statusEmoji} ${statusBadge}\n`;
  md += `> **Recommended SemVer Bump:** \`${semver}\` | **Gates Evaluated:** ${isMissing ? '— (no report)' : `${gateReport.passed || 0}/${totalGates} Passing`}\n\n`;
  if (errors.length > 0) {
    md += `> ⚠️ **Report Integrity:** ${errors.length} report error(s): ${errors.join(' ')}\n\n`;
  }

  // Gate Matrix
  md += `### 📊 SDLC Phase Quality Gates Breakdown\n\n`;
  md += `| SDLC Phase | Gate Name | Status | Details |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;

  if (gateReport.gates && gateReport.gates.length > 0) {
    for (const g of gateReport.gates) {
      const gStatus = g.status === 'PASSED' ? '✅ PASSED' : g.status === 'SKIPPED' ? '⏭️ SKIPPED' : '❌ FAILED';
      const gNotes = g.warnings
        ? '⚠️ Completed with warnings'
        : g.status === 'PASSED'
          ? 'Conforming'
          : g.status === 'SKIPPED'
            ? 'Artifact not configured'
            : 'Requires fix';
      md += `| **Phase ${g.phase}** | ${g.name} | ${gStatus} | ${gNotes} |\n`;
    }
  } else {
    const rowStatus = isPassed ? '✅ PASSED' : isMissing ? '🚨 MISSING' : '❌ FAILED';
    const rowNotes = isMissing ? 'gate-report.json was not produced' : isPassed ? 'Executed in CI' : 'Requires fix';
    md += `| *All Phases* | Master Quality Gates | ${rowStatus} | ${rowNotes} |\n`;
  }

  // Change Impact Analysis
  md += `\n### ⚡ Change Impact & SemVer Classification\n\n`;
  md += `- **Detected Changes:** ${totalChanged} modified/new file(s)\n`;
  md += `- **SemVer Bump Assessment:** \`${semver}\`\n`;

  if (diffReport.classifications?.destructive?.length > 0) {
    md += `\n> [!CAUTION]\n`;
    md += `> **Destructive / Breaking Changes Detected:**\n`;
    for (const d of diffReport.classifications.destructive) {
      md += `> - \`${d.file}\`: ${d.reason}\n`;
    }
  }

  if (callers.length > 0) {
    md += `\n**Affected Downstream Dependents (Requiring Verification):**\n`;
    for (const c of callers) {
      md += `- \`${c}\`\n`;
    }
  } else {
    md += `- **Downstream Impact:** No registered callers affected.\n`;
  }

  // Next Actions
  md += `\n---\n`;
  if (isPassed) {
    md += `🎉 **Merge Status:** Architectural boundaries, tests, and contracts are verified. Pull request is safe to merge.\n`;
  } else if (isMissing) {
    md += `🛑 **Merge Blocked:** \`gate-report.json\` was not produced, so quality cannot be certified. Run \`node bin/skillforge.mjs gate --out gate-report.json\` locally and re-run CI.\n`;
  } else {
    md += `🛑 **Merge Blocked:** One or more SDLC quality gates failed. Run \`node bin/skillforge.mjs gate\` locally to reproduce and fix.\n`;
  }

  return md;
}

function main() {
  const { diffFile, gateFile, outFile } = parseArgs();
  const errors = [];

  const diffReport = loadJson(diffFile, { highestSeverity: 'PATCH', totalChangedFiles: 0 }, errors, diffFile);
  // Fail closed: if the gate report is absent or unparseable, we must NOT claim success.
  const gateReport = loadJson(
    gateFile,
    { status: 'MISSING', totalGates: 0, passed: 0, failed: 0, missing: true },
    errors,
    gateFile,
  );

  const scorecard = generateScorecard(diffReport, gateReport, errors);

  if (errors.length > 0) {
    console.error(`⚠️  Report integrity errors (${errors.length}):`);
    errors.forEach((error) => console.error(`   - ${error}`));
  }

  if (outFile) {
    const dir = path.dirname(outFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outFile, scorecard);
    console.log(`✅ Saved PR scorecard to: ${outFile}`);
  } else {
    console.log(scorecard);
  }

  // Exit non-zero unless the gates actually passed, so CI can trust this signal.
  process.exit(gateReport.status === 'PASSED' ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('generate-pr-scorecard.mjs')) {
  main();
}
