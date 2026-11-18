# Finding triage — 41 repro assertions

This document converts the repro suite into a defensible backlog. It answers one question for each test: **is this a bug, a policy decision, or an over-strict assertion?**

- Source evidence: [`repro-transcript.md`](./repro-transcript.md)
- Findings: [`findings.json`](./findings.json)
- Machine-readable triage: [`triage.json`](./triage.json)
- Fix design: [`minimal-trust-fix.md`](./minimal-trust-fix.md)

## Summary

| Classification | Count | Meaning |
|---|---:|---|
| `confirmed-bug` | 28 | Implementation contradicts its own documented claim. Keep the test; fix the framework. |
| `policy-decision` | 11 | Secure expectation is defensible, but the product may intentionally allow it. Ratify or change policy. |
| `false-positive` | 0 | None survived review. Two tests were re-scoped rather than dropped (see `AUD-S05`, `AUD-R04`). |
| `guard` | 2 | Currently safe property; keep as a regression test. |
| **Total** | **41** | 39 red + 2 green |

> Important framing: 28 confirmed bugs cluster into **6 root causes**. Do not present this as 28 independent vulnerabilities. Four are unambiguous defects regardless of threat model: `SEC-004` dead, working-tree sign-off, signer-UID gap, and self-grading CI.

## Remediation status (2026-11-18)

All confirmed bugs and the recommended policy defaults are implemented. `npm run audit:repro` now reports **41 pass / 0 fail** and the suite is retained as a regression gate.

| Area | Status | Evidence |
|---|---|---|
| Gate policy, fail-closed runner | ✅ Fixed (P0.1) | `gate-policy.json`, `src/core/policy.mjs`; `AUD-G01`–`G07` |
| HITL sign-off binding | ✅ Fixed (P0.3) | committed-blob check, artifact SHA-256, signer key/UID, approval-date TTL, fence-aware parsing; `AUD-S01`–`S07` |
| Security auditor | ✅ Fixed | `SEC-004`, comment/multi-line scanning, untracked files, MEDIUM blocking; `AUD-R01`–`R03`, `R05`–`R07` |
| Test gate | ✅ Fixed | executes Node test files, requires executed tests and FR-/EC- citations; `AUD-T01`–`T03` |
| Document gates | ✅ Fixed / accepted | PRD substance + BDD structure (`D01`), non-empty diagrams (`D02`); ADR absence is a Phase 3 warning (`D03`) |
| MCP boundaries | ✅ Fixed | skill-name validation, workspace-confined scans, JSON gate verdicts; `AUD-M01`–`M03` |
| CI supply chain | ✅ Fixed (P0.2) | SHA-pinned actions, `--ignore-scripts`, no persisted credentials, split read-only eval / write-only report, protected-path guard, Dependabot, dependency review; `AUD-C01`–`C11` |

Ratified policy defaults:

- Build outputs (`dist/`, `build/`, `out/`, `target/`) are out of scope by default; `skillforge security --include-build-output` opts in.
- ADR absence is a warning at Phase 3 and becomes a release blocker later.
- `--allow-missing` may exist, but a skipped required gate always fails the run.
- HIGH/CRITICAL always block; MEDIUM blocks through the security validator; LOW warns.

Historical detail (pre-fix) is preserved below for traceability.

## Root causes

| ID | Root cause | Tests | Fix scope |
|---|---|---|---|
| RC-1 | Trust-domain collapse: policy, validators and CI enforcement are repo-editable | G01, G02, G05, G07, C05 | Immutable policy + pinned gate |
| RC-2 | Fail-open defaults: missing mode, skipped gates, unresolved globs | G03, G04, G06 | Fail-closed validation |
| RC-3 | Attestation not bound to identity or content | S01–S07 | Signed, content-bound attestation |
| RC-4 | Structural-only validation (tests, PRD, ADR, diagrams) | T01–T03, D01–D03 | Execute tests; content contract |
| RC-5 | Rule-engine QA gap: no positive-fixture liveness | R01–R07 | Fix rules + liveness suite |
| RC-6 | CI supply-chain hygiene | C01–C04, C06–C11 | Harden workflows |
| RC-7 | MCP tool-surface confinement | M01–M03 | Workspace-confined tools |

## Confirmed bugs (28)

### Critical (4 findings, 5 tests)

| Test | Finding | Defect | Fix |
|---|---|---|---|
| AUD-G01 | SFA-001 | Disabling a mandatory gate still returns `PASSED`; `required: true` is dead code | Reject disable/remap of required gates |
| AUD-G02 | SFA-002 | Any gate can be remapped to a weaker validator | Remove `gates.validators` from adopter config |
| AUD-S01 | SFA-010 | Uncommitted `APPROVED` edit passes against an older signed commit | Verify the committed blob at HEAD |
| AUD-R01 / R05 | SFA-020 | `SEC-004` credential rule can never match | Repair regex; add liveness test |

### High (11 tests)

| Test | Finding | Defect |
|---|---|---|
| AUD-G04 | SFA-004 | Missing `mode` silently becomes self-test |
| AUD-S02 | SFA-011 | "Artifact Hash" is the commit hash and is optional → no content binding |
| AUD-S03 | SFA-012 | Signing key UID not checked; author email is self-asserted |
| AUD-R02 | SFA-021 | Comment-line secrets (`#`, `//`, `/*`) are skipped |
| AUD-T01 | SFA-030 | Phase 5 never executes tests |
| AUD-M01 | SFA-050 | `skillName` traversal in `get_skill_instructions` |
| AUD-M02 | SFA-051 | `audit_security` scans arbitrary absolute paths |
| AUD-C01 | SFA-061 | Actions pinned to mutable tags |
| AUD-C02 | SFA-062 | `npm ci` runs dependency lifecycle scripts |
| AUD-C03 | SFA-063 | `actions/checkout` persists credentials while PR code runs |
| AUD-C05 | SFA-060/069 | CI grades the PR with the PR's own gate code; no protected paths |

### Medium / Low (12 tests)

| Test | Finding | Defect |
|---|---|---|
| AUD-G06 | SFA-006 | Unresolved required globs silently ignored |
| AUD-G07 | SFA-007 | Config never schema-validated at runtime |
| AUD-S04 | SFA-013 | TTL uses forgeable committer date |
| AUD-S06 | SFA-015 | Sign-off parsing is not fence-aware |
| AUD-R03 | SFA-022 | Multi-line CORS rule is dead under line scanning |
| AUD-R07 | SFA-025 | `--diff` excludes untracked files |
| AUD-T02 | SFA-031 | Skip-only suites pass |
| AUD-D02 | SFA-041 | Empty Mermaid fences count as diagrams |
| AUD-M03 | SFA-052 | Self-test `run_quality_gate` claims production readiness |
| AUD-C04 | SFA-066 | `|| true` masks gate/diff/scorecard failures |
| AUD-C06 | SFA-064 | Write-token job executes PR code |
| AUD-C07 | SFA-065 | No workflow-level least-privilege permissions |

## Policy decisions to ratify (11)

| Test | Finding | Question for the product owner | Recommended default |
|---|---|---|---|
| AUD-G03 | SFA-003 | May `--allow-missing` exist in project mode? | Keep for local bootstrap, never in CI; never print "ready for production" |
| AUD-G05 | SFA-005 | Are artifact paths outside the repo a supported monorepo case? | No by default; add `allowedRoots` if needed |
| AUD-S05 | SFA-014 | Is the agent denylist a control or documentation? | Documentation only; rely on key-fingerprint allow-list (S03) |
| AUD-S07 | SFA-016 | What is the machine-readable attestation verdict? | Always return `{mode, demo, artifactHashes, signerFingerprint}` |
| AUD-R04 | SFA-023 | Are `dist/`, `build/`, `bin/` in audit scope? | Out of scope by default, explicit `--include-build-output` opt-in |
| AUD-R06 | SFA-024 | Which severities block the gate? | HIGH/CRITICAL always; MEDIUM in CI; LOW warns |
| AUD-T03 | SFA-032 | Are FR-/EC- citations mandatory? | Mandatory for tests that claim a requirement mapping |
| AUD-D01 | SFA-040 | What is the minimum PRD content contract? | Non-empty FR bodies + one AC per FR; NFR targets |
| AUD-D03 | SFA-042 | Is an ADR required at Phase 3 or before release? | Warning at Phase 3, error before release |
| AUD-C08 | SFA-067 | Dependency-update policy? | Dependabot for npm + github-actions, 7-day SLA |
| AUD-C09 | SFA-068 | Vulnerability-review policy? | `dependency-review-action` required on PRs |

If the product owner chooses "allow" for any of these, the corresponding test should move to a `tests/audit/accepted/` folder and be excluded from `audit:repro` — not silently deleted.

## Guards (2)

| Test | Property |
|---|---|
| AUD-C10 | No `pull_request_target` workflow exists |
| AUD-C11 | Only first-party action owners (`actions/*`) are used |

Both should move into the normal `test:ts` suite as regression guards.

## What would change this triage

- **Branch protection evidence.** If the gate workflow is a required check, `AUD-C05/C06` drop from High to Medium but remain confirmed bugs (the runner is still self-grading).
- **Documented bootstrap mode.** If maintainers explicitly bless `--allow-missing`, `AUD-G03` becomes a documentation bug (the production claim) rather than a gate bug.
- **Monorepo requirement.** If sibling-package artifact paths are a supported scenario, `AUD-G05` becomes a missing `allowedRoots` feature.
- **MCP scope statement.** If the MCP server is explicitly local-only and trusted, `AUD-M02` becomes a hardening item, not a boundary violation.

## Confidence

| Area | Confidence | Why |
|---|---|---|
| `SEC-004` dead, working-tree sign-off, signer UID, self-grading CI | High | Verified by direct code execution and code reading |
| Gate disable/remap, zero-gate `PASSED`, untracked diff | High | Deterministic repro |
| Structural gates (PRD/test/doc) | High on behavior, medium on severity | Behavior is certain; "how much substance is enough" is policy |
| CI checks | Medium | Static YAML assertions; server-side settings unverified |
| Policy decisions | Medium | Depends on intended product contract, not code |
