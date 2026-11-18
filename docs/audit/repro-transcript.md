# Repro transcript — SkillForgeAI security audit

- Generated: 2026-11-18T11:23:36+05:30
- Command: `npm run audit:repro` (`node --experimental-strip-types --test "tests/audit/**/*.audit.ts"`)
- Result: exit 0 — 41 tests, 41 passed, 0 failed
- Status: all audit assertions now pass. The suite is retained as a regression suite for the controls described in the report.
- Historical pre-fix run: 41 tests, 2 passed, 39 failed.
- Policy decisions ratified: build outputs are out of scope by default (`--include-build-output` opts in); ADR absence is a Phase 3 warning.

```text
▶ AUD-C: CI supply chain
  ✔ AUD-C01: third-party actions must be pinned to a full commit SHA (1.2941ms)
  ✔ AUD-C02: npm ci must disable dependency lifecycle scripts (0.3435ms)
  ✔ AUD-C03: actions/checkout must not persist credentials (0.2165ms)
  ✔ AUD-C04: gate/diff commands must not be masked with "|| true" (0.2579ms)
  ✔ AUD-C05: the gate workflow must guard protected paths (0.3215ms)
  ✔ AUD-C06: jobs with write tokens must not execute PR code (0.36ms)
  ✔ AUD-C07: workflows must declare a least-privilege top-level permissions block (0.1385ms)
  ✔ AUD-C08: a dependency update bot must cover npm and github-actions (1.6409ms)
  ✔ AUD-C09: CI must run a dependency vulnerability review (0.4042ms)
  ✔ AUD-C10: workflows must not combine pull_request_target with a head checkout (0.3071ms)
  ✔ AUD-C11: only first-party action owners may be used (0.2517ms)
✔ AUD-C: CI supply chain (7.0622ms)
▶ AUD-D: document gate semantics
  ✔ AUD-D01: a PRD with headings and IDs but no substance must fail (3.22ms)
  ✔ AUD-D02: empty Mermaid fences must not satisfy the architecture diagram requirement (1.5034ms)
  ✔ AUD-D03: ADR absence is a Phase 3 warning (accepted policy) (1.2247ms)
✔ AUD-D: document gate semantics (7.0763ms)
▶ AUD-G: gate policy bypasses
  ✔ AUD-G01: disabling a mandatory gate must not yield PASSED (2.0636ms)
  ✔ AUD-G02: remapping the security gate to a weaker validator must be rejected (0.2493ms)
  ✔ AUD-G03: evaluating zero gates with --allow-missing must not yield PASSED (0.322ms)
  ✔ AUD-G04: a config without "mode" must not silently downgrade to self-test (0.2995ms)
  ✔ AUD-G05: artifact paths outside the repository must be rejected (2.1448ms)
  ✔ AUD-G06: an unresolved required glob must fail the gate (9.5403ms)
  ✔ AUD-G07: the config must be schema-validated at runtime (4.0327ms)
✔ AUD-G: gate policy bypasses (19.8553ms)
▶ AUD-M: MCP tool boundaries
  ✔ AUD-M01: get_skill_instructions must reject path traversal (72.2897ms)
  ✔ AUD-M02: audit_security must reject paths outside the workspace (65.2604ms)
  ✔ AUD-M03: run_quality_gate must not certify production in self-test mode (584.2566ms)
✔ AUD-M: MCP tool boundaries (722.9502ms)
▶ AUD-R: security rule engine
  ✔ AUD-R01: SEC-004 must flag a hardcoded credential assignment (3.4652ms)
  ✔ AUD-R02: secrets on comment lines must still be reported (1.0847ms)
  ✔ AUD-R03: multi-line permissive CORS with credentials must be reported (0.8883ms)
  ✔ AUD-R04: build outputs are excluded by default and scanned on opt-in (1.0195ms)
  ✔ AUD-R05: every documented SEC-* rule must have a live positive match (1.6266ms)
  ✔ AUD-R06: MEDIUM weaknesses (MD5) must block the security gate by default (4.6865ms)
  ✔ AUD-R07: --diff must include untracked new files (477.674ms)
✔ AUD-R: security rule engine (491.7885ms)
▶ AUD-S: sign-off integrity
  ✔ AUD-S01: an uncommitted working-tree APPROVED edit must not be accepted (443.2121ms)
  ✔ AUD-S02: approval must be bound to the approved artifact content (6.6739ms)
  ✔ AUD-S03: a valid signature from a non-allow-listed signing key must be rejected (2.255ms)
  ✔ AUD-S04: TTL must use the human approval date, not the forgeable committer date (3.092ms)
  ✔ AUD-S05: agent identity denylist must cover common coding agents (0.1863ms)
  ✔ AUD-S06: "Authorized to proceed" inside a fenced code block must not count (2.0428ms)
  ✔ AUD-S07: self-test attestations must be machine-flagged as demo-only (2.2585ms)
✔ AUD-S: sign-off integrity (461.0518ms)
▶ AUD-T: test gate integrity
  ✔ AUD-T01: a runtime-failing suite must fail the gate (104.3704ms)
  ✔ AUD-T02: a skip-only suite must fail the gate (3.4312ms)
  ✔ AUD-T03: tests without requirement IDs must fail traceability (61.0954ms)
✔ AUD-T: test gate integrity (170.2099ms)
ℹ tests 41
ℹ suites 7
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 870.9099

```
