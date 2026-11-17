# Changelog

All notable changes to SkillForgeAI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
