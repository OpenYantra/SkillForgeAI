# SkillForgeAI audit artifacts

This directory contains the read-only security and integrity audit of SkillForgeAI v1.2.0.

| File | Contents |
|---|---|
| [`2026-11-skillforge-audit.md`](./2026-11-skillforge-audit.md) | Main report: threat model, findings, PoCs, CI supply-chain chapter, remediation roadmap |
| [`findings.json`](./findings.json) | Machine-readable findings (id, severity, CWE/OWASP, `file:line`, test id, PoC) |
| [`repro-transcript.md`](./repro-transcript.md) | Captured output of the repro suites |
| [`dependency-audit.json`](./dependency-audit.json) | `npm audit --json` snapshot taken at audit time |
| [`triage.md`](./triage.md) / [`triage.json`](./triage.json) | Finding triage: confirmed bug vs policy decision vs guard, with root-cause clustering |
| [`minimal-trust-fix.md`](./minimal-trust-fix.md) | Minimal viable trust design: immutable policy, pinned CI, signed attestation, auditor fixes |

## Run the repro suites

```bash
npm run audit:repro
```

Current result: exit code `0`, **41 tests, 41 passed**.

The suite started as a set of expected-failing assertions (2 passed / 39 failed).
It is now a regression suite for the controls described in the report: a failure
means a previously-fixed control regressed.

- Gate policy, runner and config: `AUD-G*`
- HITL sign-off: `AUD-S*`
- Security rule engine: `AUD-R*`
- Test and document gates: `AUD-T*` / `AUD-D*`
- MCP boundaries: `AUD-M*`
- CI supply chain: `AUD-C*`

Ratified policy decisions: build outputs are out of scope by default
(`skillforge security --include-build-output` opts in); ADR absence is a Phase 3
warning; `--allow-missing` never turns a required skip into a pass.

The tests live in `tests/audit/*.audit.ts`. They are intentionally **not** named `*.spec.ts` so the normal `test:ts` and coverage suites stay independent.

## How to read the results

- A failing `AUD-*` test means a control regressed: the test asserts the secure behaviour and the code no longer meets it.
- `AUD-C10` / `AUD-C11` are guards: the property is currently safe and the test keeps it that way.
- Never "fix" a red test by weakening its assertion. Fix the framework, then keep the test green.

## Finding to test map

| Domain | Tests | Report section |
|---|---|---|
| Gate policy and runner | `AUD-G01..G07` | §3 |
| HITL sign-off | `AUD-S01..S07` | §4 |
| Security auditor | `AUD-R01..R07` | §5 |
| Test and document gates | `AUD-T01..T03`, `AUD-D01..D03` | §6 |
| MCP tools | `AUD-M01..M03` | §7 |
| CI supply chain | `AUD-C01..C11` | §9 |

## Guardrails for future edits

- Do not modify `src/`, `.agents/`, `.github/`, or `skillforge.config.json` as part of an audit refresh; the audit documents and regresses, it does not hide fixes.
- Fixtures must use obviously fake values. Do not add real credentials or key material.
- Keep temp directories cleaned up in `finally`; the suites must be deterministic on Windows and Linux.
