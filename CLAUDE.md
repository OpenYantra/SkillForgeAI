# SkillForgeAI Unified Agent Instructions
This codebase uses the SkillForgeAI SDLC framework. When executing software engineering tasks,
always invoke the appropriate specialized skill from `.agents/skills/<skill-name>/SKILL.md`:

## Available SDLC Skills
- **`sfa-api-contract-designer`**: Designs, specifies, and validates OpenAPI 3.1 and JSON Schema API contracts before code is written. Use in SDLC Phase 2/3 for Contract-First development to lock down endpoints, request/response DTOs, HTTP status codes, and security schemes across frontend and backend agents.
- **`sfa-cicd-container-automator`**: Scaffolds hardened container images (multi-stage Dockerfiles) and automated CI/CD pipeline workflows. Use in SDLC Phase 6 to ensure consistent builds, automated test execution on pull requests, and reliable, reproducible deployments across environments.
- **`sfa-feature-scaffolder`**: Scaffolds modular, production-ready code structures, domain models, services, and controllers according to established architectural patterns (Clean Architecture, Hexagonal, Modular MVC). Use when implementing a new feature from an approved PRD to ensure clean boundary separation, strict typing, and idiomatic code layout before writing tests.
- **`sfa-incident-root-cause-analyzer`**: Analyzes production incidents, parses error traces, reproduces defects via regression tests, and synthesizes hotfix patches. Use in SDLC Phase 7 (Maintenance & Operations) to diagnose bugs, conduct Root Cause Analysis (RCA), and prevent regressions.
- **`sfa-prd-generator-validator`**: Generates, refines, and validates Product Requirement Documents (PRDs) for features or services. Use when transforming high-level, vague, or complex feature requests into structured functional specifications, edge-case matrices, and verifiable acceptance criteria before coding starts.
- **`sfa-project-planner-estimator`**: Develops project execution roadmaps, milestone breakdowns, effort estimations, and risk registers. Use in SDLC Phase 1 (Planning & Feasibility) to convert high-level product goals into an actionable, de-risked delivery plan before formal requirements specifications begin.
- **`sfa-quality-gate-orchestrator`**: Orchestrates and enforces automated quality gates across all 7 phases of the SDLC. Use as a cross-cutting gatekeeper to verify whether deliverables (PRDs, architecture specs, source code, test suites, and CI/CD assets) satisfy quality criteria before transition.
- **`sfa-security-vulnerability-auditor`**: Audits source code changes and application architecture for security vulnerabilities, leaked secrets, and hacker-targetable software weaknesses (OWASP Top 10, CWE Top 25). Use in SDLC Phase 6 and pre-commit/PR gates to ensure resilient, exploit-resistant applications.
- **`sfa-system-architecture-adr`**: Generates system architecture specifications, C4 model diagrams, and Architecture Decision Records (ADRs). Use in SDLC Phase 3 to evaluate design trade-offs, define service boundaries, and document non-functional architectural choices before scaffolding code.
- **`sfa-unit-test-synthesizer`**: Synthesizes comprehensive, deterministic unit and component test suites based on specifications and source code. Use to write isolated tests following the Arrange-Act-Assert (AAA) pattern, validating happy paths, boundary conditions, error branches, and mock external dependencies.

## Core Rules for All Agents & Models
1. **Never Guess Requirements:** For new features, execute `sfa-prd-generator-validator` first.
2. **Architecture Boundaries:** Enforce Clean Architecture. Domain entities must not import infrastructure frameworks.
3. **Traceability:** All tests must cite requirement IDs (e.g. `FR-001`, `EC-001`).
4. **Automated Quality Gate:** Before finishing a task or opening a PR, always run:
   ```bash
   node .agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs
   ```
