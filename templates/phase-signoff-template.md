# SDLC Phase Sign-Off: [Feature / Service Name]

- **Target Phase:** Phase 2 (Requirements) | Phase 3 (Architecture) | Phase 6 (Production Release)
- **Status:** PENDING_REVIEW | APPROVED | REJECTED
- **Reviewed By (Human):** [Human Name / Lead Architect / Product Owner]
- **Reviewer Role:** [e.g. Lead Architect, Tech Lead, Product Manager]
- **Approval Date:** YYYY-MM-DD
- **Commit / Artifact Hash:** [Git SHA of the reviewed artifact / sign-off commit]

> **Human attestation required.** Set the status to `APPROVED`, check the
> authorisation boxes below, and commit this file with a **signed commit**
> (`git commit -S`). The verification gate rejects unsigned or agent-authored
> sign-offs. `skillforge signoff` only generates `PENDING_REVIEW` drafts.

---

## 1. Review Checklist & Verification
- [ ] Scope and non-goals are clearly bounded.
- [ ] Edge cases and failure modes are explicitly specified.
- [ ] Security, auth, and data privacy boundaries are satisfied.
- [ ] Architecture respects Clean Architecture and dependency inversion.
- [ ] All automated validation scripts passed with 0 errors.

---

## 2. Reviewer Notes & Approvals
*The human reviewer explicitly authorizes the AI coding agent to proceed to the next SDLC Phase.*

**Authorized Next Phase:**
- [ ] Authorized to proceed to **Phase 4: Feature Scaffolding & Implementation**
- [ ] Authorized for **Phase 6: Production Deployment**
