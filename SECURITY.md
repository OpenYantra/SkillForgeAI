# Security Policy

## Supported versions

| Version | Supported |
| :--- | :--- |
| 1.2.x | ✅ |
| < 1.2 | ❌ |

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report privately via
GitHub Security Advisories:

https://github.com/rishikesh-net/SkillForgeAI/security/advisories/new

Include:

- Affected version (`skillforge version`)
- Command or module involved
- Reproduction steps or a minimal proof of concept
- Impact assessment (what an attacker could do)

We aim to acknowledge reports within 3 business days and to publish a coordinated
fix and advisory when the issue is resolved.

## Security tooling in this repository

- `node bin/skillforge.mjs security [--diff] [--strict]` audits for secrets and
  OWASP/CWE-class weaknesses.
- `node bin/skillforge.mjs gate --phase 6` runs the security gate.
- CI runs the security gate and the full test/coverage suite on every push and
  pull request.

Never commit credentials or private keys. Load secrets from environment
variables or a secret manager.
