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

## Dependency policy

- `@types/node` follows the Node runtime major (currently 24). Do not bump it to
  a newer major without also bumping `engines.node` and the CI Node version.
- `tree-sitter` and all grammar packages (`tree-sitter-*`) are upgraded together
  in one PR. Their 0.x minor bumps are breaking and are intentionally ignored by
  Dependabot.
- `typescript` and `typescript-eslint` are upgraded together. TypeScript minor and
  major bumps are ignored until the `typescript-eslint` peer range supports them.
- GitHub Actions minor/patch updates are grouped and run monthly. Action majors
  require a manual, reviewed upgrade with release-note and input/output checks.
- Dependabot PRs that touch `.github/workflows` are exempt from the
  `skillforge:policy-change` label; human and agent PRs still require it.
- Keep every action pinned to a full 40-character commit SHA.

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
