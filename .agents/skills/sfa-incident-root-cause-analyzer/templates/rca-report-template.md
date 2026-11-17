# Root Cause Analysis (RCA): [Incident Title]

- **Incident ID:** INC-[NUMBER]
- **Severity:** P1 (Critical) | P2 (High) | P3 (Medium)
- **Date of Incident:** YYYY-MM-DD
- **Target SDLC Phase:** Phase 7 (Maintenance & Operations)
- **Status:** Resolved | Closed

---

## 1. Executive Summary & Impact
*Brief description of what went wrong, user-facing impact, and duration of degradation.*
- **Downtime / Disruption Duration:** [e.g., 24 minutes]
- **Affected Users / Systems:** [e.g., 3.2% of checkout attempts]

---

## 2. Incident Timeline (UTC)
- **HH:MM** — First automated alert triggered / exception detected.
- **HH:MM** — Incident response initiated; reproduction harness created.
- **HH:MM** — Root cause identified in service layer.
- **HH:MM** — Hotfix deployed to staging and verified with regression tests.
- **HH:MM** — Production patch released; monitoring metrics returned to normal.

---

## 3. Root Cause Analysis (5-Whys)
1. **Why did the service return 500 errors?**
   An unhandled `TypeError: Cannot read properties of undefined` was thrown during order calculation.
2. **Why was the property undefined?**
   The incoming item contained an empty discount coupon code object.
3. **Why was the discount object malformed?**
   The client API allowed null values for optional promotion attributes without default sanitization.
4. **Why did the backend not catch this?**
   DTO input validation lacked strict schema checks for nested coupon properties.
5. **Why was this not covered in testing?**
   Test cases only covered valid promotion codes or completely absent fields, not explicit `null`.

---

## 4. Remediation & Regression Prevention

| Action Item | Owner | Target Date | Status |
| :--- | :--- | :--- | :--- |
| **ACT-001** | Add regression test verifying explicit null coupon objects | Engineering | Done |
| **ACT-002** | Add strict Zod schema validation to Order DTO | Engineering | Done |
| **ACT-003** | Update PRD edge-case checklist to mandate null vs omitted checks | QA | Done |
