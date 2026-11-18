/**
 * SkillForgeAI: Security Vulnerability & Weakness Auditor (core engine)
 * Audits code changes and application codebases for:
 * 1. Hardcoded secrets, keys, and credentials (CWE-798, CWE-259)
 * 2. SQL Injection vulnerabilities (CWE-89)
 * 3. OS Command Injection vulnerabilities (CWE-78)
 * 4. Code Injection and Unsafe Deserialization (CWE-94, CWE-502)
 * 5. Path Traversal vulnerabilities (CWE-22)
 * 6. Cross-Site Scripting sinks (CWE-79)
 * 7. Weak / Broken Cryptography (CWE-327, CWE-328)
 * 8. Security Misconfigurations (CWE-16, CWE-942)
 * 9. Server-Side Request Forgery sinks (CWE-918)
 *
 * Supports:
 * - Target directory or file audit
 * - Git diff / staged change audit
 * - Machine-readable JSON output (--json)
 * - Strict warning enforcement (--strict)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

// Security Rules & CWE Mappings
const RULES = [
  // 1. Secrets & Credentials (CWE-798, CWE-259)
  {
    id: 'SEC-001',
    cwe: 'CWE-798',
    name: 'Hardcoded Private Key',
    severity: SEVERITY.CRITICAL,
    regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|PGP|DSA)?\s*PRIVATE\s+KEY-----/i,
    description: 'Hardcoded private cryptographic key exposed in source code.',
    hackerVector:
      'Attackers extract keys from source code or build artifacts to impersonate servers or decrypt traffic.',
    remediation:
      'Store private keys in environment variables or cloud secret managers (e.g. AWS Secrets Manager, Azure Key Vault).',
  },
  {
    id: 'SEC-002',
    cwe: 'CWE-798',
    name: 'Exposed AWS Access Key',
    severity: SEVERITY.CRITICAL,
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    description: 'AWS Access Key ID hardcoded in source code.',
    hackerVector: 'Compromised cloud infrastructure, data exfiltration, and resource hijacking.',
    remediation: 'Use IAM roles, AWS Secrets Manager, or load credentials from environment variables.',
  },
  {
    id: 'SEC-003',
    cwe: 'CWE-798',
    name: 'Exposed API Token / Secret Key',
    severity: SEVERITY.HIGH,
    regex:
      /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{36,}|sk-proj-[a-zA-Z0-9_-]{20,}|xox[baprs]-[0-9a-zA-Z]{10,48}|(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24})\b/,
    description: 'Third-party API key or service token detected in source code.',
    hackerVector: 'Attackers make unauthorized requests, alter accounts, or exhaust paid API quotas.',
    remediation: 'Extract token into secure environment configuration (e.g. .env excluded via .gitignore).',
  },
  {
    id: 'SEC-004',
    cwe: 'CWE-798',
    name: 'Hardcoded Credential Assignment',
    severity: SEVERITY.HIGH,
    regex:
      /(?:password|passwd|apiKey|apiSecret|jwtSecret|clientSecret|dbPassword)\s*[:=]\s*["'](?!(?:test|mock|dummy|fake|placeholder|<.*>|undefined|null|process\.env))[^"']{8,}["']/i,
    description: 'Potential hardcoded password, API secret, or JWT key string literal.',
    hackerVector:
      'Attackers inspect client-side code or public repositories to authenticate as legitimate users/services.',
    remediation: 'Load secrets from environment variables or vault backends at runtime.',
  },

  // 2. Injection Flaws (CWE-89, CWE-78)
  {
    id: 'SEC-005',
    cwe: 'CWE-89',
    name: 'SQL Injection via String Concatenation',
    severity: SEVERITY.CRITICAL,
    regex:
      /(?:\.query|\.execute|ExecuteSqlRaw|FromSqlRaw|ExecuteSqlCommand|cursor\.execute)\s*\(\s*(?:[`"'].*?\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.*?[`"']\s*\+|\s*[`"].*?\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b.*?\$\{)/i,
    description: 'Dynamic SQL query built via string concatenation or template literal interpolation.',
    hackerVector:
      'SQL injection allows bypass of authentication, extraction of entire databases, and remote code execution.',
    remediation: 'Use parameterized queries (e.g., $1, @param, ?) or an ORM with type-safe query builders.',
  },
  {
    id: 'SEC-006',
    cwe: 'CWE-78',
    name: 'OS Command Injection',
    severity: SEVERITY.CRITICAL,
    regex:
      /(?:\bexec|\bexecSync|Process\.Start|os\.system|subprocess\.(?:Popen|call|run))\s*\(\s*(?:[`"'].*?\+|\s*`.*?\$\{|\s*f["'].*?\{)/i,
    description: 'Dynamic OS command built with unvalidated string concatenation.',
    hackerVector:
      'Attackers append shell metacharacters (&, |, ;, `) to execute arbitrary commands with host privileges.',
    remediation: 'Use spawn/execFile with an explicit argument array and shell disabled (shell: false).',
  },
  {
    id: 'SEC-007',
    cwe: 'CWE-78',
    name: 'Shell Spawn with Shell Mode Enabled',
    severity: SEVERITY.HIGH,
    regex: /spawn\s*\([^,]+,\s*\{[^}]*shell:\s*true/i,
    description: 'Process spawned with shell: true option enabled, exposing arguments to shell interpolation.',
    hackerVector: 'Command injection when any argument contains untrusted user input.',
    remediation:
      'Disable shell mode ({ shell: false }) and execute executable binaries directly with parameter arrays.',
  },

  // 3. Code Execution & Deserialization (CWE-94, CWE-502)
  {
    id: 'SEC-008',
    cwe: 'CWE-94',
    name: 'Arbitrary Code Execution via eval / new Function',
    severity: SEVERITY.CRITICAL,
    regex: /\b(?:eval|new\s+Function)\s*\(/,
    description: 'Dynamic JavaScript code execution via eval() or new Function().',
    hackerVector: 'Enables remote code execution (RCE) if any part of the evaluated expression is influenced by input.',
    remediation: 'Refactor to safe static logic, use JSON.parse() for data parsing, or isolate in secure sandboxes.',
  },
  {
    id: 'SEC-009',
    cwe: 'CWE-502',
    name: 'Insecure Deserialization',
    severity: SEVERITY.CRITICAL,
    regex: /(?:pickle\.loads|BinaryFormatter\(\)\.Deserialize|yaml\.load\s*\([^,]+(?!\s*,\s*Loader))/i,
    description: 'Insecure object deserialization of untrusted payloads.',
    hackerVector:
      'Attackers craft malicious serialized byte streams that execute arbitrary code upon object reconstruction.',
    remediation: 'Use safe serialization formats (JSON, Protocol Buffers) and safe YAML loaders (yaml.safe_load).',
  },

  // 4. Path Traversal (CWE-22)
  {
    id: 'SEC-010',
    cwe: 'CWE-22',
    name: 'Potential Path Traversal in File Operation',
    severity: SEVERITY.HIGH,
    regex:
      /(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync|File\.OpenRead|File\.ReadAllText)\s*\(\s*(?:req\.|params\.|query\.|body\.|userInput|filename\s*\+)/i,
    description: 'File operation taking request parameters directly without canonical path validation.',
    hackerVector: 'Attackers supply dot-dot-slash (../../etc/passwd) to read or overwrite sensitive system files.',
    remediation:
      'Sanitize file paths with path.basename() and verify the resolved path starts with the allowed root directory.',
  },

  // 5. Cross-Site Scripting (CWE-79)
  {
    id: 'SEC-011',
    cwe: 'CWE-79',
    name: 'Cross-Site Scripting (XSS) via innerHTML / dangerouslySetInnerHTML',
    severity: SEVERITY.HIGH,
    regex: /(?:\.innerHTML\s*=|dangerouslySetInnerHTML\s*=)/,
    description: 'Direct HTML injection sink without explicit sanitization.',
    hackerVector:
      'Attackers inject JavaScript to steal session cookies, hijack accounts, or redirect users to phishing sites.',
    remediation: 'Use textContent / innerText, or sanitize HTML using DOMPurify before rendering.',
  },

  // 6. Cryptographic Weaknesses (CWE-327, CWE-328, CWE-330)
  {
    id: 'SEC-012',
    cwe: 'CWE-328',
    name: 'Broken Cryptographic Hash Algorithm (MD5 / SHA-1)',
    severity: SEVERITY.MEDIUM,
    regex:
      /(?:createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)|MD5\.Create\(\)|SHA1\.Create\(\)|hashlib\.(?:md5|sha1)\s*\()/i,
    description: 'Use of collision-vulnerable cryptographic hash algorithm (MD5 or SHA-1).',
    hackerVector: 'Hash collision attacks, credential cracking, and integrity signature forgery.',
    remediation: 'Upgrade to SHA-256 / SHA-512 for data integrity, or Argon2id / bcrypt / PBKDF2 for password hashing.',
  },
  {
    id: 'SEC-013',
    cwe: 'CWE-330',
    name: 'Insecure Randomness for Security Tokens',
    severity: SEVERITY.MEDIUM,
    regex: /(?:token|secret|apiKey|sessionId|authCode|salt)\s*=\s*.*?\bMath\.random\s*\(\)/i,
    description: 'Math.random() used in the context of generating security tokens or identifiers.',
    hackerVector:
      'PRNG state predictability allows attackers to anticipate session IDs, reset tokens, or cryptographic nonces.',
    remediation:
      'Use cryptographically secure pseudorandom number generators (CSPRNG): crypto.randomBytes() or RandomNumberGenerator.',
  },

  // 7. Security Misconfigurations (CWE-16, CWE-942)
  {
    id: 'SEC-014',
    cwe: 'CWE-942',
    name: 'Permissive Wildcard CORS with Credentials',
    severity: SEVERITY.HIGH,
    multiline: true,
    regex:
      /(?:origin:\s*['"]\*['"][\s\S]*?credentials:\s*true|Access-Control-Allow-Origin:\s*\*[\s\S]*?Access-Control-Allow-Credentials:\s*true)/i,
    description: 'Access-Control-Allow-Origin wildcard (*) configured alongside credentials: true.',
    hackerVector: 'Malicious websites can issue authenticated cross-origin requests to exfiltrate private user data.',
    remediation: 'Specify an explicit, validated list of allowed origins when credentials are supported.',
  },
  {
    id: 'SEC-015',
    cwe: 'CWE-295',
    name: 'Disabled TLS Certificate Validation',
    severity: SEVERITY.CRITICAL,
    regex:
      /(?:rejectUnauthorized:\s*false|verify\s*=\s*False|ServerCertificateCustomValidationCallback\s*=[\s\S]*?true)/i,
    description: 'TLS/SSL certificate validation disabled in HTTP client or server configuration.',
    hackerVector: 'Man-in-the-Middle (MITM) attacks intercepting, reading, or tampering with encrypted communications.',
    remediation: 'Enable certificate validation in all environments and install trusted root certificates properly.',
  },

  // 8. Server-Side Request Forgery (CWE-918)
  {
    id: 'SEC-016',
    cwe: 'CWE-918',
    name: 'Potential Server-Side Request Forgery (SSRF)',
    severity: SEVERITY.HIGH,
    regex:
      /(?:fetch|axios\.(?:get|post)|http\.(?:get|request)|HttpClient\.GetAsync)\s*\(\s*(?:req\.(?:query|params|body)\.[a-zA-Z0-9_]+|userInputUrl)/i,
    description: 'HTTP request initiated directly with unvalidated URL from client request parameters.',
    hackerVector:
      'Attackers coerce internal server into querying internal microservices, AWS metadata endpoints (169.254.169.254), or local networks.',
    remediation:
      'Validate destination URLs against an allowlist of domains and block access to private/loopback IP ranges.',
  },
];

// Directories and file patterns to ignore
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.opencode',
  'dist',
  'build',
  'bin',
  'obj',
  'coverage',
  '.vs',
  '.vscode',
]);

const BUILD_OUTPUT_DIRS = new Set(['dist', 'build', 'out', 'target']);

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
  '.cs',
  '.py',
  '.go',
  '.java',
  '.kt',
  '.json',
  '.yaml',
  '.yml',
  '.env',
  '.dockerfile',
  '.sh',
  '.bash',
  '.ps1',
]);

function getGitDiffFiles(stagedOnly = false) {
  try {
    const args = stagedOnly ? ['diff', '--name-only', '--cached'] : ['diff', '--name-only', 'HEAD'];
    const output = execFileSync('git', args, { encoding: 'utf-8' });
    const files = output
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0 && fs.existsSync(f));

    if (!stagedOnly) {
      const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf-8' });
      for (const file of untracked.split('\n').map((entry) => entry.trim())) {
        if (file && fs.existsSync(file) && !files.includes(file)) files.push(file);
      }
    }

    return files;
  } catch {
    return [];
  }
}

function collectFiles(targetPath, fileList = [], errors = [], options = {}) {
  const includeBuildOutput = options.includeBuildOutput === true;

  if (!fs.existsSync(targetPath)) {
    errors.push({ file: targetPath, kind: 'target', message: `Target not found: ${targetPath}` });
    return fileList;
  }

  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch (err) {
    errors.push({ file: targetPath, kind: 'read', message: err.message });
    return fileList;
  }

  if (stat.isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    const base = path.basename(targetPath).toLowerCase();
    if (SCANNABLE_EXTENSIONS.has(ext) || base.includes('dockerfile') || base.startsWith('.env')) {
      fileList.push(targetPath);
    }
    return fileList;
  }

  if (stat.isDirectory()) {
    const baseDir = path.basename(targetPath);
    const buildOutput = includeBuildOutput && BUILD_OUTPUT_DIRS.has(baseDir);
    if (IGNORE_DIRS.has(baseDir) && !buildOutput) return fileList;

    let entries;
    try {
      entries = fs.readdirSync(targetPath, { withFileTypes: true });
    } catch (err) {
      errors.push({ file: targetPath, kind: 'read', message: err.message });
      return fileList;
    }
    for (const entry of entries) {
      const entryBuildOutput = includeBuildOutput && BUILD_OUTPUT_DIRS.has(entry.name);
      if (IGNORE_DIRS.has(entry.name) && !entryBuildOutput) continue;
      const fullPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        collectFiles(fullPath, fileList, errors, options);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const base = entry.name.toLowerCase();
        if (SCANNABLE_EXTENSIONS.has(ext) || base.includes('dockerfile') || base.startsWith('.env')) {
          fileList.push(fullPath);
        }
      }
    }
  }

  return fileList;
}

export function scanFile(filePath, errors = []) {
  const findings = [];
  let content;

  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    errors.push({ file: filePath, kind: 'read', message: err.message });
    return findings;
  }

  const lines = content.split('\n');
  const extension = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();
  const scanComments =
    extension === '.env' ||
    extension === '.yaml' ||
    extension === '.yml' ||
    extension === '.sh' ||
    extension === '.bash' ||
    extension === '.ps1' ||
    baseName.startsWith('.env') ||
    baseName.includes('dockerfile');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();
    if (
      !scanComments &&
      (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
    ) {
      continue;
    }

    for (const rule of RULES) {
      if (rule.multiline) continue;
      if (rule.regex.test(line)) {
        findings.push({
          ruleId: rule.id,
          cwe: rule.cwe,
          name: rule.name,
          severity: rule.severity,
          file: filePath.replace(/\\/g, '/'),
          line: lineIndex + 1,
          snippet: line.trim().slice(0, 140),
          description: rule.description,
          hackerVector: rule.hackerVector,
          remediation: rule.remediation,
        });
      }
    }
  }

  // Multi-line rules are evaluated against the whole file so formatting does
  // not hide the pattern.
  for (const rule of RULES) {
    if (!rule.multiline) continue;
    const match = content.match(rule.regex);
    if (!match || match.index === undefined) continue;
    const line = content.slice(0, match.index).split('\n').length;
    findings.push({
      ruleId: rule.id,
      cwe: rule.cwe,
      name: rule.name,
      severity: rule.severity,
      file: filePath.replace(/\\/g, '/'),
      line,
      snippet: match[0].replace(/\s+/g, ' ').trim().slice(0, 140),
      description: rule.description,
      hackerVector: rule.hackerVector,
      remediation: rule.remediation,
    });
  }

  return findings;
}

export function runSecurityAudit(options = {}) {
  const {
    target = '.',
    diff = false,
    staged = false,
    strict = false,
    json = false,
    silent = false,
    includeBuildOutput = false,
  } = options;
  const emit = silent ? () => {} : (...args) => globalThis.console.log(...args);

  let filesToScan;
  const scanErrors = [];

  if (diff || staged) {
    filesToScan = getGitDiffFiles(staged);
    if (filesToScan.length === 0) {
      if (json) {
        emit(JSON.stringify({ status: 'PASSED', filesScanned: 0, findings: [], errors: [] }));
      } else {
        emit('✅ No modified files detected in Git diff. Working tree clean.');
      }
      return { status: 'PASSED', findings: [], filesScanned: 0, errors: [] };
    }
  } else {
    filesToScan = collectFiles(path.resolve(target), [], scanErrors, { includeBuildOutput });
  }

  const allFindings = [];

  for (const file of filesToScan) {
    const fileFindings = scanFile(file, scanErrors);
    allFindings.push(...fileFindings);
  }

  const criticals = allFindings.filter((f) => f.severity === SEVERITY.CRITICAL);
  const highs = allFindings.filter((f) => f.severity === SEVERITY.HIGH);
  const mediums = allFindings.filter((f) => f.severity === SEVERITY.MEDIUM);
  const lows = allFindings.filter((f) => f.severity === SEVERITY.LOW);

  const hasScanFailure = scanErrors.some((error) => error.kind === 'target');
  const hasFailingFlaws =
    hasScanFailure || (strict ? allFindings.length > 0 : criticals.length > 0 || highs.length > 0);

  const status = hasFailingFlaws ? 'FAILED' : 'PASSED';

  if (json) {
    const report = {
      timestamp: new Date().toISOString(),
      status,
      target: target || '.',
      filesScanned: filesToScan.length,
      summary: {
        total: allFindings.length,
        critical: criticals.length,
        high: highs.length,
        medium: mediums.length,
        low: lows.length,
      },
      findings: allFindings,
      errors: scanErrors,
    };
    emit(JSON.stringify(report, null, 2));
    return report;
  }

  // Terminal UI Display
  emit('\n======================================================');
  emit('🛡️  SkillForgeAI: Security Vulnerability & Weakness Auditor');
  emit('======================================================\n');
  emit(`Audited Target   : ${target}`);
  emit(`Files Scanned    : ${filesToScan.length}`);
  emit(
    `Findings Summary : ${criticals.length} Critical, ${highs.length} High, ${mediums.length} Medium, ${lows.length} Low\n`,
  );

  if (scanErrors.length > 0) {
    emit(`\n⚠️  SCAN ERRORS (${scanErrors.length}):`);
    for (const error of scanErrors) emit(`   - ${error.file}: ${error.message}`);
  }

  if (allFindings.length === 0 && scanErrors.length === 0) {
    emit('✅ PASSED: No software security weaknesses or vulnerabilities detected!\n');
    return { status: 'PASSED', findings: [], filesScanned: filesToScan.length, errors: scanErrors };
  }

  for (const finding of allFindings) {
    const badge =
      finding.severity === SEVERITY.CRITICAL
        ? '🚨 CRITICAL'
        : finding.severity === SEVERITY.HIGH
          ? '❌ HIGH'
          : finding.severity === SEVERITY.MEDIUM
            ? '⚠️  MEDIUM'
            : 'ℹ️  LOW';

    emit(`------------------------------------------------------`);
    emit(`${badge} [${finding.ruleId}] ${finding.name} (${finding.cwe})`);
    emit(`File: ${finding.file}:${finding.line}`);
    emit(`Code: ${finding.snippet}`);
    emit(`Hacker Vector: ${finding.hackerVector}`);
    emit(`Remediation  : ${finding.remediation}`);
  }
  emit(`------------------------------------------------------\n`);

  if (hasFailingFlaws) {
    emit(`🛑 AUDIT FAILED: Security vulnerabilities must be remediated before deployment.\n`);
  } else {
    emit(`⚠️  AUDIT PASSED WITH WARNINGS: Review medium/low findings.\n`);
  }

  return { status, findings: allFindings, filesScanned: filesToScan.length, errors: scanErrors };
}
