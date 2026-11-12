# SkillForgeAI Unified Agent Instructions
This codebase uses the SkillForgeAI SDLC framework. When executing software engineering tasks,
always invoke the appropriate specialized skill from `.agents/skills/<skill-name>/SKILL.md`:

## Available SDLC Skills
- **`api-contract-designer`**: Designs, specifies, and validates OpenAPI 3.1 and JSON Schema API contracts before code is written.
- **`cicd-container-automator`**: Scaffolds hardened container images (multi-stage Dockerfiles) and automated CI/CD pipeline workflows.
- **`feature-scaffolder`**: Scaffolds modular, production-ready code structures, domain models, services, and controllers
- **`incident-root-cause-analyzer`**: Analyzes production incidents, parses error traces, reproduces defects via regression tests,
- **`prd-generator-validator`**: Generates, refines, and validates Product Requirement Documents (PRDs) for features or services.
- **`project-planner-estimator`**: Develops project execution roadmaps, milestone breakdowns, effort estimations, and risk registers.
- **`quality-gate-orchestrator`**: Orchestrates and enforces automated quality gates across all 7 phases of the SDLC.
- **`system-architecture-adr`**: Generates system architecture specifications, C4 model diagrams, and Architecture Decision
- **`unit-test-synthesizer`**: Synthesizes comprehensive, deterministic unit and component test suites based on specifications

## Core Rules for All Agents & Models
1. **Never Guess Requirements:** For new features, execute `prd-generator-validator` first.
2. **Architecture Boundaries:** Enforce Clean Architecture. Domain entities must not import infrastructure frameworks.
3. **Traceability:** All tests must cite requirement IDs (e.g. `FR-001`, `EC-001`).
4. **Automated Quality Gate:** Before finishing a task or opening a PR, always run:
   ```bash
   node .agents/skills/quality-gate-orchestrator/scripts/run-all-gates.mjs
   ```
