/**
 * SkillForge CLI: Security Command
 * Audits code changes and application source for vulnerabilities, leaked secrets,
 * and hacker-targeted software weaknesses (OWASP Top 10, CWE Top 25).
 */

import { runSecurityAudit } from '../../core/security-audit.mjs';
import { printError, colors } from '../ui.mjs';

export function executeSecurity(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bold}Usage:${colors.reset}
  skillforge security [options]

${colors.bold}Options:${colors.reset}
  --path <dir>      Audit a specific directory or file path (default: current workspace)
  --diff            Audit uncommitted changes in Git working tree
  --staged          Audit only staged Git files
  --strict          Fail (exit 1) on warnings (MEDIUM/LOW) as well as errors
  --include-build-output
                    Also scan dist/build/out/target directories (excluded by default)
  --json            Emit machine-readable JSON results (for CI/CD PR bots)
  --help, -h        Show this help message

${colors.bold}Examples:${colors.reset}
  skillforge security
  skillforge security --diff
  skillforge security --path examples/order-service/src
  skillforge security --strict
  skillforge security --json
`);
    process.exit(0);
  }

  const isDiff = args.includes('--diff');
  const isStaged = args.includes('--staged');
  const isStrict = args.includes('--strict');
  const isJson = args.includes('--json');
  const includeBuildOutput = args.includes('--include-build-output');

  const pathIndex = args.indexOf('--path');
  let targetPath = pathIndex !== -1 ? args[pathIndex + 1] : null;

  if (!targetPath) {
    const nonFlagArg = args.find((a) => !a.startsWith('-'));
    targetPath = nonFlagArg || '.';
  }

  try {
    const result = runSecurityAudit({
      target: targetPath,
      diff: isDiff,
      staged: isStaged,
      strict: isStrict,
      json: isJson,
      includeBuildOutput,
    });

    if (result.status === 'FAILED') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message, status: 'FAILED' }));
    } else {
      printError(`Security audit encountered an error: ${err.message}`);
    }
    process.exit(1);
  }
}
