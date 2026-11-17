# Edge-Case & Boundary Analysis Checklist

When specifying software requirements for AI coding agents, edge cases are where agents make the most assumptions or produce brittle code. Use this checklist during Phase 2 to ensure comprehensive specifications.

---

## 1. Input Data Boundaries
- [ ] **Empty States:** Empty arrays, empty strings `""`, whitespace-only strings `"   "`.
- [ ] **Boundary Numbers:** Minimum integer/float, 0, negative values, maximum integer overflow/underflow, floating point precision issues (`0.1 + 0.2`).
- [ ] **String Extremes:** Extremely long strings (exceeding database column lengths), multi-byte Unicode/emojis, special characters (`<script>`, SQL fragments, directory traversal `../`).
- [ ] **Nullability:** Explicit distinction between `null`, `undefined`, and omitted keys.

## 2. State & Lifecycle Boundaries
- [ ] **Duplication / Idempotency:** What happens if the same request is submitted multiple times simultaneously?
- [ ] **Out-of-Order Execution:** Messages or events arriving out of chronological order.
- [ ] **State Machine Invariants:** Transitioning from invalid states (e.g., trying to refund a cancelled order, activating an already archived item).

## 3. Concurrency & Race Conditions
- [ ] **Optimistic / Pessimistic Locking:** Simultaneous edits to the same resource.
- [ ] **Resource Starvation / Exhaustion:** Connection pool limits, file descriptor limits.

## 4. Downstream Dependencies & Network Failures
- [ ] **Timeouts:** External API, database query, or message broker timeouts.
- [ ] **Degraded Service:** Downstream service returning 500, 502, or 503 errors.
- [ ] **Partial Failures:** 2 out of 3 operations succeed; rollback / saga transaction handling.

## 5. Security & Authorization
- [ ] **Authentication Missing/Expired:** Expired JWT token, invalid bearer format.
- [ ] **Authorization Boundaries (IDOR):** User A requesting resource owned by User B.
- [ ] **Rate Limiting / DoS:** Exceeding burst and sustained rate quotas.
