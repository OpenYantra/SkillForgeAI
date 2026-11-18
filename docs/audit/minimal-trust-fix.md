# Minimal viable trust fix — design

Goal: close the 28 confirmed bugs with the smallest set of architectural changes, without pretending to solve every policy question at once. The design is intentionally narrow: **three P0 changes** plus a **P1 correctness pass**.

**Status:** all P0 and P1 items implemented (2026-11-18). `npm run audit:repro` → 41/41.

- Triage: [`triage.md`](./triage.md) / [`triage.json`](./triage.json)
- Evidence: [`repro-transcript.md`](./repro-transcript.md)
- Acceptance for every item is the corresponding `AUD-*` test turning green.

---

## Design principles

1. **Policy must live outside the governed workspace.** The agent may propose artifacts; it may not define how they are judged.
2. **Fail closed.** A missing input is never a success. A skipped required gate is a failure.
3. **Bind approvals to bytes and keys.** "Approved" must identify *which* artifact content and *which* reviewer key.
4. **Evaluate from an immutable source.** CI must not execute the PR's implementation of the gate that grades the PR.
5. **Keep the human workflow.** Attestations remain human-readable; the machine-readable envelope is authoritative.

---

## P0.1 — Immutable gate policy

**Status:** ✅ Implemented 2026-11-18. `AUD-G01`–`G07` pass.

**Closes:** `AUD-G01`–`G07` (RC-1, RC-2)
**Estimate:** 3–5 engineer-days

### Current
`skillforge.config.json` contains `mode`, `artifacts`, `gates.disable`, `gates.validators`, and `governance`. The gate runner trusts all of it. `required: true` on every registry entry is never read.

### Target
Split "what to check" (project-owned) from "how it is checked" (framework-owned):

```jsonc
// skillforge.config.json (adopter)
{
  "version": 2,
  "mode": "project",
  "artifacts": { "prd": "docs/PRD.md", "src": "src" },
  "governance": { "allowedReviewerKeys": ["FPR..."], "signoffTtlDays": 30 }
}
```

The gate list, validators, required flags and severity policy come from a framework-owned **policy manifest**:

```jsonc
// gate-policy.json (shipped, signed)
{
  "policyVersion": 1,
  "gates": [
    { "id": "prd", "phase": 2, "validator": "prd", "required": true, "blocking": ["error"] }
  ],
  "policyHash": "sha256:..."
}
```

### Design
- `src/core/policy.mjs`
  - `loadPolicy({ source })` — load the manifest from the installed framework package (not the adopter repo).
  - `verifyPolicy(manifest, signature, publicKey)` — verify a detached signature over the canonical JSON.
  - `assertPolicyUnmodified(manifest)` — recompute and compare `policyHash`.
- `loadGateConfig` becomes artifact-only. `gates.*` is removed from the schema; loading a config that still contains it throws with a migration hint.
- `runGates` fails when:
  - a `required` gate is missing/skipped;
  - a configured glob resolves to zero files (unless marked `optional`);
  - the policy hash does not match the signed manifest;
  - no `skillforge.config.json` exists and `--self-test` was not passed explicitly.
- The gate report records `policyVersion`, `policyHash`, `frameworkVersion`.

### Acceptance
| Test | Expected after fix |
|---|---|
| AUD-G01 | Disabling a required gate throws, no `PASSED` |
| AUD-G02 | `gates.validators` is rejected by schema + loader |
| AUD-G04 | Missing `mode` throws |
| AUD-G06 | Unresolved required glob → `FAILED`/`UNRESOLVED` |
| AUD-G07 | Unknown keys rejected |

### Migration
1. Schema v2; `skillforge init` writes artifacts-only config.
2. `skillforge gate` prints a migration error for v1 configs with `gates.disable/validators`.
3. Release note: gate disabling is now a break-glass procedure, not config.
4. If a break-glass override is required, implement it as a time-boxed, signed override recorded in the report — never a silent config switch.

### Residual risk
If CI still runs the repository checkout of the framework, an agent can edit `policy.mjs`. P0.2 removes that path by pinning the evaluator.

---

## P0.2 — Pinned, self-grading-resistant CI

**Status:** ✅ Implemented 2026-11-18. `AUD-C01`–`C11` pass.

**Closes:** `AUD-C01`, `AUD-C02`, `AUD-C03`, `AUD-C04`, `AUD-C05`, `AUD-C06`, `AUD-C07` (RC-1, RC-6)
**Estimate:** 2–3 engineer-days

### Current
One job with `pull-requests: write` runs `npm ci` and `node bin/skillforge.mjs gate` from the PR checkout, masks failures with `|| true`, and feeds a JSON report to later steps.

### Target — two workflows
1. **`gate-eval.yml`** — `permissions: { contents: read }`
   - Checks out the PR **for artifacts only**.
   - Installs the gate from a pinned, published source, not from the PR:
     - `npm exec --yes skillforge-ai@<exact-version> -- gate ...`, or
     - `uses: <org>/skillforge-gate@<40-char-sha>` (composite action that downloads a release and verifies a checksum).
   - Applies a protected-path guard:
     ```bash
     git fetch origin "$BASE" --depth=1
     if git diff --name-only "origin/$BASE"...HEAD -- src/core bin .agents .github skillforge.config.json | grep .; then
       echo "::error::Protected enforcement paths changed"; exit 1
     fi
     ```
   - Uploads `gate-report.json` as an artifact.
2. **`gate-report.yml`** — `on: workflow_run`, `permissions: { pull-requests: write }`
   - Downloads the report artifact, renders the scorecard, comments.
   - **No checkout, no `npm ci`, no execution of PR code.**

### Hardening checklist
- Every `uses:` pinned to a 40-character SHA.
- `npm ci --ignore-scripts` (separate reviewed step if a build needs scripts).
- `persist-credentials: false` on every checkout.
- `permissions: {}` at workflow level; grant per job.
- No `|| true` on gate/diff/scorecard steps; missing report is a failure.
- Add `actions/dependency-review-action` and Dependabot (`npm` + `github-actions`).
- Add `.github/CODEOWNERS` for `src/core`, `bin`, `.agents/`, `.github/workflows/`, `skillforge.config.json`, `gate-policy.json`.
- Verify server-side: branch protection, required checks, default token permissions, environment secrets.

### Acceptance
`AUD-C01`–`AUD-C07` green; `AUD-C10`/`C11` remain green.

### Residual risk
Actions cache poisoning and self-hosted runners. Mitigation: disable `cache:` for the eval job or scope caches per ref; prefer GitHub-hosted runners for the evaluator.

---

## P0.3 — Signed, content-bound attestation

**Status:** ✅ Implemented 2026-11-18 (markdown attestations hardened; `demo` verdict, artifact SHA-256 binding, committed-blob check, signer UID and approval-date TTL). `AUD-S01`–`S07` pass.

**Closes:** `AUD-S01`, `AUD-S02`, `AUD-S03`, `AUD-S04`, `AUD-S06`, `AUD-S07` (RC-3)
**Estimate:** 4–6 engineer-days

### Current
A Markdown file is parsed with regexes. Identity comes from `%ae`; signature is `%G?`; the "artifact hash" is the commit SHA; TTL uses `%cI`; the working tree is read instead of the commit.

### Target — signed envelope + rendered view
Authoritative file: `docs/approvals/<feature>.attestation.json`

```jsonc
{
  "version": 1,
  "feature": "order-service",
  "phase": 3,
  "decision": "APPROVED",
  "authorizations": ["phase-4"],
  "reviewer": {
    "name": "Dana Human",
    "email": "dana@corp.com",
    "keyFingerprint": "SHA256:..."
  },
  "issuedAt": "2026-11-18T09:00:00Z",
  "expiresAt": "2026-12-18T09:00:00Z",
  "commit": "<full sha>",
  "artifacts": [
    { "path": "docs/PRD.md", "sha256": "..." },
    { "path": "docs/architecture.md", "sha256": "..." }
  ],
  "signature": { "scheme": "gpg|ssh|sigstore", "value": "<detached signature>" }
}
```

Rendered `docs/approvals/<feature>.md` is generated from the JSON for humans and is **not authoritative**.

### Verification order
1. **Read the committed blob**: `git show HEAD:<path>`; refuse if the working tree differs from HEAD (fixes `AUD-S01`).
2. **Verify the signature** over the canonical JSON (excluding `signature`), using `gpg --verify`, `ssh-keygen -Y verify`, or Sigstore.
3. **Match the signing key** fingerprint to `governance.allowedReviewerKeys` — not to an email (`AUD-S03`).
4. **Recompute artifact hashes** from the working tree at gate time and compare (`AUD-S02`).
5. **Check `issuedAt`/`expiresAt`** against the signed timestamps, reject future-dated attestations (`AUD-S04`).
6. **Parse only the JSON** — no regex over Markdown (`AUD-S06`).
7. **Return a structured verdict**: `{mode, demo, reviewerKey, artifacts, passed}`; `demo: true` in self-test and no deployment authorization (`AUD-S07`).

### CLI changes
- `skillforge signoff` generates the JSON envelope and the rendered Markdown, always `PENDING_REVIEW`.
- `skillforge signoff --sign --key <id>` signs the envelope (or prints the exact command for the human).
- `skillforge signoff --verify <path>` runs the verification order above.

### Migration
1. Ship v1 attestation support behind a feature flag; accept legacy Markdown **only in self-test**.
2. Deprecation window: legacy Markdown fails in project mode after the next minor.
3. `.gitattributes`: mark `*.attestation.json` as text (no normalization).

### Residual risk
Key custody and revocation. Add a `governance.revokedKeys` list and a CI check; prefer hardware-backed keys or Sigstore/OIDC for reviewers.

---

## P1 — Auditor correctness pass

**Status:** ✅ Implemented 2026-11-18. `AUD-R01`–`R07` pass (R04 is the ratified opt-in policy).

**Closes:** `AUD-R01`, `AUD-R02`, `AUD-R03`, `AUD-R05`, `AUD-R07` (RC-5)
**Estimate:** 3–4 engineer-days

1. **Fix SEC-004**: remove the empty-matching `\s*` from the negative lookahead; split the allowlist into explicit alternatives.
2. **Rule liveness suite**: one positive fixture per `SEC-*` rule; fail CI when a rule has no positive match. This is the durable fix for RC-5.
3. **Multi-line scanning**: scan a sliding window (or the parsed config) for SEC-014; do not rely on single-line regexes with `[\s\S]`.
4. **Comment policy per extension**: scan `.env`/YAML/Dockerfile regardless of comment marker; skip code comments only, and support `// nosec` / `# nosec` suppression.
5. **Untracked files**: use `git status --porcelain` for `--diff`, or require `--staged` for pre-commit.
6. **Severity policy** (pending ratification): HIGH/CRITICAL always block; MEDIUM blocks in CI; LOW warns.

### Also required before trusting MCP with untrusted content (P1.5)

**Status:** Implemented 2026-11-18.

- AUD-M01: validate skillName against ^[a-z0-9-]+$ and assert the resolved path stays under .agents/skills.
- AUD-M02: confine audit_security to the workspace root by default.
- AUD-M03: return JSON gate verdicts; no "ready for production" claim from self-test.

### Test execution (P1.6)

**Status:** Implemented 2026-11-18.

- AUD-T01 / AUD-T02: Phase 5 executes Node test files, uses the exit code, and requires executed tests.

---

## Coverage matrix

| Change | Tests | Status |
|---|---|---|
| P0.1 Immutable policy | G01-G07 | Done |
| P0.2 Pinned CI | C01-C07 | Done |
| P0.3 Attestation | S01-S04, S06, S07 | Done |
| P1 Auditor | R01-R03, R05-R07 | Done |
| P1.5 MCP | M01-M03 | Done |
| P1.6 Test execution | T01, T02 | Done |
| D01/D02 document quality | D01, D02 | Done |
| Policy decisions | S05, R04, R06, T03, D03, C08, C09 | Done (R04/D03 accepted) |

AUD-C10 and AUD-C11 are guards and remain green.

## Sequencing (executed)

1. **P0.1 + P0.2:** immutable policy + pinned/split CI.
2. **P0.3:** content-bound sign-off.
3. **P1 + P1.5 + P1.6:** auditor, MCP and test execution.
4. **Policy:** ratified defaults applied; R04 and D03 encoded as accepted policy tests.

**Definition of done:** npm run audit:repro -> **41/41**; npm run test:ts -> **177/177**; coverage, lint, format, typecheck and the framework's own 10 gates are green.

## Non-goals

- Replacing regex-based rule detection with a full SAST engine.
- Proving PRD/architecture "quality" semantically; the contract becomes "minimum content + cross-reference integrity", not "is this a good design".
- Server-side GitHub configuration as code; it must be verified and documented separately.
- Guaranteeing reviewer honesty; the design binds *which key* approved, not *whether the human understood the artifact*.
