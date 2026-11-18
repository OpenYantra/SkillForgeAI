# Contributing to SkillForgeAI

Thanks for improving the SkillForgeAI SDLC framework. This repository contains
the CLI, shared engines, skill definitions, validators, templates, and examples.

## Prerequisites

- Node.js **22.6+** (24 recommended; `--experimental-strip-types` is used by tests)
- Git
- .NET 10 SDK (optional; only for the C# example/tests)

## Setup

```bash
npm ci
```

`npm ci` is required for source checkouts: parsers and validators depend on
runtime packages such as `yaml` and `tree-sitter`.

## Development loop

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:ts
npm run test:coverage
```

Run the SDLC quality gates before pushing:

```bash
node .agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs
```

## Governance and policy changes

- Gate policy is framework-owned in `gate-policy.json`. After an intentional edit,
  run `npm run policy:hash` and commit the updated hash.
- `skillforge.config.json` (version 2) may map gates to artifacts only. Do not add
  `gates.disable` or `gates.validators`; the loader rejects them.
- Pull requests that change enforcement paths (`src/core`, `bin`, `.agents`, workflows,
  `skillforge.config.json`, `gate-policy.json`) are blocked by the CI protected-path
  guard. A maintainer reviews the change and applies the `skillforge:policy-change`
  label to bypass the guard.
- Add `.github/CODEOWNERS` entries when you introduce a new enforcement path.
- HITL sign-offs must be committed, bind to artifact SHA-256 hashes, and use an
  allow-listed reviewer identity/key.

## Repository layout

| Path | Purpose |
| :--- | :--- |
| `bin/` | Unified `skillforge` CLI (lazy-loads command modules) |
| `src/core/` | Shared engines: code graph, diff, security audit, signoff, gates, heal |
| `src/core/validators/` | YAML/Markdown/Dockerfile-aware validators |
| `src/core/parsers/` | tree-sitter symbol extraction and import resolution |
| `src/cli/` | CLI commands and rendering only |
| `.agents/skills/` | Skill definitions, templates, and thin validator wrappers |
| `scripts/` | Standalone wrappers and maintenance scripts |
| `tests/` | `node --test` suites (`*.spec.ts`) |

Keep **`src/core` free of `.agents` imports**. Skill/script wrappers may import
core modules, not the other way around.

## Generated artifacts

Do not hand-edit generated files. Regenerate and commit them together with the
source change:

```bash
node bin/skillforge.mjs graph          # docs/context/{code-graph.json,REPO-MAP.md,slices/*}
node scripts/sync-editors.mjs          # AGENTS.md, editor configs, .opencode/instructions.md
```

CI runs `graph --check` and `sync-editors --check` to catch drift.

## Commit and PR conventions

- Branch from `main` (`feat/...`, `fix/...`, `chore/...`, `docs/...`).
- Use Conventional Commit subjects, e.g. `feat(gates): ...`, `fix(ci): ...`.
- Keep PRs focused; include tests for behavior changes.
- `main` is merged with `--no-ff` merge commits.
- Do not commit secrets, local model configuration (`.opencode/opencode.json`),
  generated reports (`gate-report.json`, `diff-report.json`), or `docs/context/LATEST-TEST-FAILURE.json`.

## Reporting issues

- Bugs/features: https://github.com/rishikesh-net/SkillForgeAI/issues
- Security vulnerabilities: see [SECURITY.md](SECURITY.md)
