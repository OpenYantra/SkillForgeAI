# Changelog

All notable changes to SkillForgeAI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-11-18

### Security

- Gate policy is now framework-owned and hash-verified in `gate-policy.json`.
  `skillforge.config.json` can map gates to artifacts but can no longer disable
  gates or remap validators (`gates.disable` / `gates.validators` removed).
- Missing `mode`, skipped required gates, unresolved required globs, and artifact
  paths outside the repository (or `allowedRoots`) now fail closed.
- A missing `skillforge.config.json` no longer downgrades to self-test: `gate`
  fails unless `--self-test` is passed explicitly.
- `--allow-missing` still reports skips, but exits non-zero while any required
  gate is skipped.
- The gate report records `policyVersion` and `policyHash`.
- HITL sign-off now verifies the committed blob (no uncommitted approvals),
  binds approval to artifact SHA-256 hashes, checks the signing identity against
  `allowedReviewers` / `allowedKeys`, uses the approval date for TTL, and ignores
  fenced example content. Self-test verdicts return `demo: true`.
- Security auditor: fixed the dead `SEC-004` credential rule, scans secrets in
  `.env`/YAML comments, evaluates multi-line rules, includes untracked files in
  `--diff`, and blocks MEDIUM findings through the gate adapter. Build outputs are
  out of scope by default; `--include-build-output` opts in.
- MCP: `get_skill_instructions` rejects path traversal, `audit_security` is
  confined to the workspace, and `run_quality_gate` returns structured JSON.
- CI is split into a read-only immutable evaluator and a write-only report job;
  actions are SHA-pinned, install scripts are disabled for `npm ci`, checkout
  credentials are not persisted, protected enforcement paths are guarded, and
  Dependabot + dependency review are enabled.
- Governance accepts `allowedKeys` (signing key fingerprints).
- The Phase 5 test gate executes Node test files and requires FR-/EC- citations;
  the PRD gate requires substantive FR text and structured BDD scenarios; empty
  Mermaid fences no longer satisfy the architecture gate.

### Changed

- **Breaking:** `skillforge.config.json` schema is now version 2. Version 1 configs must
  remove `gates` and set `"version": 2`.
- **Breaking:** a missing `skillforge.config.json` and gate overrides are rejected;
  pass `--self-test` explicitly to validate framework templates.
- The in-process gate runner rejects configuration that attempts to override
  framework-owned policy.
- `skillforge security` gains `--include-build-output`.
- ADR absence remains a Phase 3 warning and is treated as a release blocker later.

## [1.2.0] - 2026-11-17

### Added

- Shared `src/core/` engines for the code graph, semantic diff, security audit,
  sign-off verification, and quality gates; CLI/script/skill files are thin wrappers.
- tree-sitter parsers for TypeScript/TSX, JavaScript, C#, Python, and Go, with
  exact-path import resolution and parser metadata in the generated graph.
- YAML/OpenAPI, fence-aware Markdown, Dockerfile, and CI-workflow parsing in the
  skill validators (optional `@apidevtools/swagger-parser` full-spec validation).
- `src/core/heal.mjs`: monorepo test-project discovery, bounded retry loop,
  optional fixer script, and structured incident packages.
- `skillforge graph --check` and a CI step that fail on stale `docs/context` artifacts.
- `gates.disable` / `gates.validators` overrides in `skillforge.config.json`.
- LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG, and a `files`
  whitelist for npm packaging.

### Changed

- The quality gate runner now executes validators in-process; `skillforge gate`
  and the orchestrator skill share identical behavior (`--json/--strict/--out`).
- CLI commands and gate validators are lazy-loaded, so unrelated commands no
  longer require parser dependencies.
- Child processes use argument arrays (`execFileSync`/`spawnSync`) instead of
  interpolated shell strings.
- Scaffolding is non-destructive by default; use `--force` or `--backup` to
  overwrite existing files.
- Version is sourced from `package.json` for both the CLI and MCP server.

### Fixed

- The SDLC gate workflow now runs `npm ci` before invoking the CLI, fixing
  `ERR_MODULE_NOT_FOUND: yaml` failures.
- Git, security-scan, graph-parse, and scorecard failures are reported as
  structured diagnostics instead of being silently swallowed.
- Missing security targets fail closed with scan errors.
- Malformed gate/diff reports are surfaced in the PR scorecard.

[Unreleased]: https://github.com/rishikesh-net/SkillForgeAI/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/rishikesh-net/SkillForgeAI/releases/tag/v1.2.0
