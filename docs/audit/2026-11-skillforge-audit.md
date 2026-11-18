# SkillForgeAI Security & Integrity Audit

- **Target:** SkillForgeAI v1.2.0 (commit under audit: repository HEAD on 2026-11-18)
- **Audit type:** read-only. No files under `src/`, `.agents/`, `.github/`, or `skillforge.config.json` were modified.
- **Deliverables:** this report, [`findings.json`](./findings.json), [`repro-transcript.md`](./repro-transcript.md), [`dependency-audit.json`](./dependency-audit.json), [`triage.md`](./triage.md) (confirmed bug vs policy decision), [`minimal-trust-fix.md`](./minimal-trust-fix.md), and 7 expected-failing repro suites under `tests/audit/`.
- **Reproduce:** `npm run audit:repro` → exit 1, 41 tests, **2 guard tests pass, 39 findings fail**.
- **Finding counts:** 4 Critical, 14 High, 18 Medium, 4 Low, 1 Informational.
- **Triage:** 28 confirmed bugs, 11 policy decisions, 2 guards, 0 false positives. These are not 28 independent vulnerabilities — they cluster into 6 root causes. All confirmed bugs and the recommended policy defaults are now implemented; see [`triage.md`](./triage.md) and [`minimal-trust-fix.md`](./minimal-trust-fix.md).
- **Remediation status (2026-11-18):** **P0.1, P0.2, P0.3, P1, P1.5 and P1.6 implemented; shipped in v2.0.0.** Gate policy is framework-owned and hash-verified; CI is split into a read-only immutable evaluator and a write-only report job; sign-off is bound to the committed blob, signer identity and artifact SHA-256; the security auditor, test gate, document gates and MCP boundaries are corrected. `AUD-*` is 41/41. Ratified policy: build outputs are out of scope by default (`--include-build-output` opts in); ADR absence is a Phase 3 warning.

---

## 1. Executive summary

SkillForgeAI documents itself as an "enterprise-grade" SDLC platform where quality gates are "fail-closed", HITL sign-off is "verified", and the security auditor enforces "OWASP Top 10 / CWE Top 25". The audit found that the enforcement layer and the policy that configures it live in the **same trust domain as the AI agent they are meant to constrain**. An agent with ordinary repository write access can:

1. **Disable the gate that constrains it** and still receive a `PASSED` certification.
2. **Replace the security auditor with a weaker validator** via config.
3. **Obtain a "project is ready for production" verdict while zero gates were evaluated.**
4. **Self-approve the HITL gate** by editing the sign-off file in the working tree without committing.
5. **Bypass the security auditor entirely** for hardcoded credentials: the `SEC-004` rule is dead code.

Three headline results were verified directly:

```text
# 1. Disable the mandatory security gate (config is repo-owned)
runGates({ selfTest: true, config: { gates: { disable: ["security"] } } })
→ 9 passed, 0 failed, 0 skipped, status: PASSED

# 2. Remap the security gate to the scaffold boundary check
runGates({ phase: 6, config: { gates: { validators: { security: "scaffold" } } } })
→ container PASSED, security PASSED (the auditor never ran)

# 3. Zero evaluated gates + --allow-missing
skillforge gate --allow-missing   # empty artifact config
→ 0 passed, 0 failed, 10 skipped, status: PASSED
→ "ALL SDLC QUALITY GATES PASSED! Project is ready for production."
```

**Status:** all three config-controlled gate bypasses above are closed (P0.1). The `AUD-G*` tests are green and retained as regression tests.

The CI pipeline does not close the gap: `.github/workflows/skillforge-gate.yml` executes the **pull request's own copy** of `src/core/gate-runner.mjs`, so a PR can change the grade it receives. On top of that, the workflow masks failures with `|| true`, uses mutable action tags, runs `npm ci` with install scripts, persists checkout credentials, and has no dependency review.

---

## 2. Threat model and trust boundaries

**Adversary:** an autonomous coding agent (or a contributor it influences) with normal write access to the repository, including `src/`, `.agents/`, `.github/`, and `skillforge.config.json`. It cannot read the repository's server-side settings (branch protection, environment secrets).

**Trust boundaries as designed:**

```
[ human reviewer identity ]  --GPG/commit-->  [ sign-off document ] --gate--> [ SDLC phases ]
[ framework-owned code ]     --validator-->   [ project artifacts  ]
[ CI runner / GITHUB_TOKEN ] --workflow-->    [ merge decision     ]
```

**Trust boundary as implemented:** the "framework-owned code", the policy (`skillforge.config.json`), the artifacts, and the gates themselves are all files in the same repository the agent can edit. Nothing is pinned, signed, or fetched from an immutable source at enforcement time. This collapses the first two boundaries into one.

The only boundary that is partially real is the human identity check, and it is defeated by author-email spoofing plus an attacker-controlled signing key (see §5).

---

## 3. Gate policy and the runner

| ID | Sev | Finding | Anchor | Repro |
|---|---|---|---|---|
| SFA-001 | Critical | `gates.disable` removes mandatory gates with no warning; `required: true` is never read | `src/core/gate-registry.mjs:197-205` | AUD-G01 |
| SFA-002 | Critical | `gates.validators` remaps any gate to a weaker in-process validator | `src/core/gate-registry.mjs:200-204` | AUD-G02 |
| SFA-003 | High | Success is `failed === 0`, so "nothing evaluated" is `PASSED` | `src/core/gate-runner.mjs:92-115,215` | AUD-G03 |
| SFA-004 | High | Missing/invalid `mode` silently becomes `self-test` | `src/core/gate-registry.mjs:165,186-189` | AUD-G04 |
| SFA-005 | Medium | Explicit artifact paths outside the repo are accepted | `src/core/glob.mjs:57-60` | AUD-G05 |
| SFA-006 | Medium | Unresolved required globs are silently dropped | `src/core/gate-registry.mjs:229-236` | AUD-G06 |
| SFA-007 | Medium | Config is never validated against `skillforge.config.schema.json` at runtime | `src/core/gate-registry.mjs:158-178` | AUD-G07 |

Why this matters: the gate registry is the single source of truth for all 10 gates, and both entrypoints (`skillforge gate` and the skill orchestrator) share it. A single config edit changes every automated phase transition.

Additional detail for SFA-002: the remap is not limited to known-safe keys. `gates.validators.security = "scaffold"` passes the schema (`additionalProperties: { "type": "string" }`) and routes the phase-6 security gate to a directory-boundary scan.

---

## 4. Human-in-the-Loop sign-off

| ID | Sev | Finding | Anchor | Repro |
|---|---|---|---|---|
| SFA-010 | Critical | Working-tree content checked against an older signed commit (uncommitted approval) | `src/core/signoff-verify.mjs:45,97` | AUD-S01 |
| SFA-011 | High | "Commit / Artifact Hash" is the commit hash and is optional → no artifact binding | `src/core/signoff-verify.mjs:65-66,122-126` | AUD-S02 |
| SFA-012 | High | Signing-key UID never compared to `allowedReviewers`; author email is self-asserted | `src/core/governance.mjs:59` | AUD-S03 |
| SFA-013 | Medium | TTL uses `%cI` (committer date), which is forgeable | `src/core/governance.mjs:74-78` | AUD-S04 |
| SFA-014 | Medium | Agent denylist omits cursor/devin/aider/gemini/codex/anthropic | `src/core/governance.mjs:13-21` | AUD-S05 |
| SFA-015 | Medium | Sign-off parsing is not fence-aware | `src/core/signoff-verify.mjs:48-71` | AUD-S06 |
| SFA-016 | Medium | Self-test verdict has no machine-readable demo flag | `src/core/signoff-verify.mjs:92-95` | AUD-S07 |

**The uncommitted-approval bypass (SFA-010)** is the most practical: commit a `PENDING_REVIEW` draft authored by a legitimate reviewer, then edit the file to `APPROVED` and check the authorization box without committing. `verifySignOff` reads the working-tree bytes but calls `git log -1` on the path, which returns the older signed commit. Result: `passed: true`.

**Identity spoofing (SFA-012):** the commit format string is `%H|%ae|%G?|%cI`. `%ae` is whatever the commit object says (set with `git -c user.email=...`), and `%G? === "G"` only proves *a* valid signature exists — not that the signing key belongs to the allow-listed reviewer. The fix requires comparing `%GS`/`%GF` (signer identity/fingerprint) against allow-listed *keys*.

**Artifact binding (SFA-011):** the gate claims to compare an "artifact hash", but the value is compared against the committing SHA. Mutating the PRD after approval has no effect. Omitting the field skips the check entirely.

---

## 5. Security auditor

| ID | Sev | Finding | Anchor | Repro |
|---|---|---|---|---|
| SFA-020 | Critical | `SEC-004` hardcoded-credential regex can never match | `src/core/security-audit.mjs:74` | AUD-R01, R05 |
| SFA-021 | High | All `#`, `//`, `*`, `/*` lines are skipped | `src/core/security-audit.mjs:353-356` | AUD-R02 |
| SFA-022 | Medium | Multi-line CORS-with-credentials rule is dead in line scanning | `src/core/security-audit.mjs:199-200` | AUD-R03, R05 |
| SFA-023 | Medium | `bin/`, `dist/`, `build/` are excluded | `src/core/security-audit.mjs:234-245` | AUD-R04 |
| SFA-024 | High | MEDIUM findings never block; CI does not use `--strict` | `src/core/validators/security.mjs:40-45` | AUD-R06 |
| SFA-025 | Medium | `--diff` excludes untracked files | `src/core/security-audit.mjs:273` | AUD-R07 |

**Why SEC-004 is dead:**

```js
/(?:password|passwd|apiKey|...)\s*[:=]\s*["'](?!(?:test|mock|...|\s*|...))[^"']{8,}["']/i
//                                                    ^^^^
// \s* matches the empty string, so the negative lookahead always fails.
```

Every candidate value starts at a position where `\s*` matches zero characters, so the lookahead rejects all inputs. `AUD-R01` and the rule-liveness test (`AUD-R05`) both fail with `rules without a positive match: SEC-004, SEC-014`.

**Rule liveness gap:** the suite has no test that asserts each rule fires on a positive fixture, which is why the dead rule shipped. `tests/security-auditor.spec.ts` covers SQLi, command injection, `eval`, AWS keys, MD5 and TLS, but not credential assignments or CORS.

**Severity policy gap (SFA-024):** the adapter converts MEDIUM/LOW findings into `warnings`, and `runGates` only escalates warnings in `--strict` mode. The CI workflow does not pass `--strict`. MD5 password hashing therefore produces a green gate.

---

## 6. Test and document gates

| ID | Sev | Finding | Anchor | Repro |
|---|---|---|---|---|
| SFA-030 | High | Phase 5 never executes tests; it counts `it(`/`expect(` | `src/core/validators/coverage.mjs:49-59,111-116` | AUD-T01 |
| SFA-031 | Medium | `it.skip(...)`-only suites pass | `src/core/validators/coverage.mjs:49-59` | AUD-T02 |
| SFA-032 | Low | Missing FR-/EC- citations only warn (violates AGENTS.md rule 3) | `src/core/validators/coverage.mjs:118-122` | AUD-T03 |
| SFA-040 | High | PRD gate accepts headings + `FR-001` + the words "Given When Then" | `src/core/validators/prd.mjs:26-56` | AUD-D01 |
| SFA-041 | Medium | Empty ` ```mermaid ` fences count as C4 diagrams | `src/core/validators/architecture.mjs:31-34` | AUD-D02 |
| SFA-042 | Low | Missing ADR index only warns | `src/core/validators/architecture.mjs:38-40` | AUD-D03 |

The consequence is compliance theatre: a document containing `None. / N/A / FR-001 / Given When Then.` is "complete"; two empty code fences are "architecture"; a failing test suite is "verified".

---

## 7. MCP tool surface

| ID | Sev | Finding | Anchor | Repro |
|---|---|---|---|---|
| SFA-050 | High | `get_skill_instructions` path traversal via `skillName` | `scripts/mcp-server.mjs:208-214` | AUD-M01 |
| SFA-051 | High | `audit_security` scans arbitrary absolute paths and returns snippets | `scripts/mcp-server.mjs:248-256` | AUD-M02 |
| SFA-052 | Medium | `run_quality_gate` inherits self-test and claims production readiness | `scripts/mcp-server.mjs:196-201` | AUD-M03 |

These are prompt-injection surfaces: an agent that processes untrusted text can be steered into reading files outside the workspace or into reporting a false production certification to its user.

---

## 8. Git hooks

`scripts/install-git-hooks.mjs` writes `.git/hooks/pre-commit` and `pre-push`. Findings:

- Hooks are **not installed automatically**: `package.json` has no `prepare`/`postinstall`, and both hook files are absent in a fresh checkout.
- Both hooks are bypassable with `git commit --no-verify` / `git push --no-verify`.
- The pre-push hook calls `run-all-gates.mjs`, which reads the same repo-editable config, so it inherits SFA-001/002/004.
- The pre-commit hook only runs breaking-change detection, not the security audit.

Hooks should be treated as developer convenience, not an enforcement boundary.

---

## 9. CI/CD supply chain

| ID | Sev | Finding | Anchor | Repro |
|---|---|---|---|---|
| SFA-060 | High | CI grades the PR using the PR's own gate code | `.github/workflows/skillforge-gate.yml:48-52` | AUD-C05 |
| SFA-061 | High | 8 `uses:` references pinned to mutable tags, not SHAs | both workflows | AUD-C01 |
| SFA-062 | High | `npm ci` runs dependency lifecycle scripts | both workflows | AUD-C02 |
| SFA-063 | High | `actions/checkout` persists the token while PR code runs | both workflows | AUD-C03 |
| SFA-064 | Medium | `pull-requests: write` job executes PR code | `skillforge-gate.yml:19-22` | AUD-C06 |
| SFA-065 | Medium | No workflow-level least-privilege `permissions` | `skillforge-gate.yml:14-22` | AUD-C07 |
| SFA-066 | Medium | `|| true` on gate/diff/scorecard steps | `skillforge-gate.yml:46,51,63` | AUD-C04 |
| SFA-067 | Medium | No Dependabot/Renovate | `.github/dependabot.yml` missing | AUD-C08 |
| SFA-068 | Medium | No `npm audit` / dependency review in CI | workflows | AUD-C09 |
| SFA-069 | Low | No CODEOWNERS for enforcement code | `CODEOWNERS` missing | AUD-C05 (partial) |
| SFA-070 | Low | `dotnet run` builds PR-controlled MSBuild targets | `ci.yml:67` | report-only |

**The self-grading problem (SFA-060).** The enforcement step is:

```yaml
node bin/skillforge.mjs gate --out gate-report.json || true
...
node -e "... if (report.status !== 'PASSED') process.exit(1) ..."
```

The report is produced by the PR's `src/core/gate-runner.mjs` with the PR's `skillforge.config.json`. A PR that adds `"gates": { "disable": ["security", "signoff"] }`, or edits the runner, produces a green report. No protected-path guard compares these files to the base branch.

**Dependency snapshot.** `npm audit --json` (captured in `dependency-audit.json`): 14 production, 140 development, 166 total dependencies; 13 advisories — **0 critical, 9 high, 4 moderate**. All are in the dev toolchain (`eslint`/`typescript-eslint`/`c8`/`glob`/`picomatch`/`fdir`/`tinyglobby`); no vulnerable production dependency was reported. CI has no step that surfaces or blocks these.

**Guards that currently hold (keep them):**

- No `pull_request_target` workflow (AUD-C10).
- Only first-party action owners (`actions/*`) are used (AUD-C11).

**Not verifiable from the repository:** branch protection, required status checks, default `GITHUB_TOKEN` permissions, environment protection, and whether the gate workflow is a required check. These must be verified in GitHub organization settings; the in-repo evidence suggests they are load-bearing for the security claims.

---

## 10. Historical: tests that codified the insecure behaviour

These tests originally asserted the bypass as intended behaviour. They were updated as
part of the remediation and now assert the secure contract:

- `tests/gate-config.spec.ts` - `--allow-missing` now fails while a required gate is skipped.
- `tests/quality-gate-orchestrator.spec.ts` - same for the skill orchestrator.
- `tests/signoff-governance.spec.ts` - sign-offs now bind to artifacts and the committed blob.
- `tests/security-auditor.spec.ts` - `SEC-004` and multi-line rules have positive fixtures.
- `tests/mcp-server.spec.ts` - MCP sign-off paths are self-test (demo) only; project mode requires the full attestation.

## 11. Remediation roadmap

**P0 — restore the trust boundary (blocks the critical findings)**

1. Make gate enablement immutable at runtime; reject `gates.disable` and `validators` for required gates. Hash the policy and compare it to a signed baseline. *(SFA-001/002/007)*
2. Fail closed: require explicit `mode`, treat skipped required gates as failures, remove `--allow-missing` from CI. *(SFA-003/004)*
3. Verify the sign-off **committed blob** at HEAD, not the working tree. *(SFA-010)*
4. Bind approval to artifact path + SHA-256 and make the field mandatory. *(SFA-011)*
5. Verify the signing key fingerprint/UID against allow-listed reviewer keys. *(SFA-012)*
6. Run CI gates from an immutable pinned source and add a protected-path guard + CODEOWNERS. *(SFA-060/069)*

**P1 — make the auditors real**

7. Fix `SEC-004` and add a rule-liveness test that requires a positive fixture per rule. *(SFA-020)*
8. Scan multi-line, comment, `.env`, and build-output locations; include untracked files in `--diff`. *(SFA-021/022/023/025)*
9. Define a severity policy that blocks MEDIUM by default. *(SFA-024)*
10. Execute the test suite in the Phase 5 gate and require executed tests. *(SFA-030/031)*
11. Make the MCP tools workspace-confined and return structured verdicts. *(SFA-050/051/052)*

**P2 — supply chain and hardening**

12. Pin actions to SHAs, `npm ci --ignore-scripts`, `persist-credentials: false`, least-privilege permissions, remove `|| true`. *(SFA-061–066)*
13. Add Dependabot and dependency review. *(SFA-067/068)*
14. Add semantic checks to document gates (non-empty diagrams, cross-references, minimum content). *(SFA-040/041/042)*
15. Install hooks automatically and document them as convenience only. (§8)

Each item maps to an `AUD-*` test; the test is the acceptance criterion. The red suites can be converted to green by fixing the framework, then removed from `audit:repro` and added to `test:ts`.

---

## 12. Reproduce

```bash
# All findings (expected to fail until fixed)
npm run audit:repro

# Expected (current): 41 tests, 41 pass, exit code 0
# Historical: 2/39 pre-fix; 9/32 after P0.1
# Full output is captured in docs/audit/repro-transcript.md

# Confirm the normal suite is unaffected
npm run test:ts        # 167 pass
npm run lint
npm run format:check
npm run typecheck
```

The suites are deliberately named `*.audit.ts` so the `test:ts` glob (`tests/**/*.spec.ts`) and the coverage gate do not pick them up.

---

## 13. Limitations

- The audit is source-level and deterministic. It does not fuzz the parsers or attempt network exploitation.
- Dependency advisories reflect the snapshot captured at audit time; `npm audit` data changes.
- Server-side GitHub configuration (branch protection, required checks, token defaults, environment secrets) cannot be read from the repository and is therefore listed as unverifiable rather than assumed safe.
- The CI checks are static assertions over workflow YAML; they do not execute the workflows.
- `AUD-G01` is intentionally run with `selfTest: true` so the baseline passes; the bypass is identical in project mode.
- No real secrets were used. Fixtures contain documented example patterns (`AKIAIOSFODNN7EXAMPLE`, key headers without key material).
