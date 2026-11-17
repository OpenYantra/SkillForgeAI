# Unit Testing & Mocking Guidelines for Agents

To avoid brittle, flaky, or overly complex test suites, coding agents must observe these core mocking guidelines:

---

## 1. The Cardinal Rule of Mocking
> **"Do not mock what you do not own."**
> **"Never mock the unit under test."**

- **Do NOT mock:**
  - Pure domain entities, value objects, or standard libraries (`Array`, `Math`, `Map`).
  - Internal private methods of the class being tested.
- **DO mock:**
  - External I/O boundaries: databases, file systems, network/HTTP APIs, message brokers, system clock (`Date.now()`).

---

## 2. Prefer Fakes Over Complex Spies
- **Fakes (Recommended):** Lightweight, working in-memory implementations of your domain interfaces (e.g., `InMemoryUserRepository` using a JavaScript `Map`). They simulate real behavior without mocking libraries.
- **Spies / Mocks (Secondary):** Used only when asserting that a side effect happened (e.g., asserting an event was dispatched or email notification triggered).

---

## 3. Avoid Test Over-Coupling
- **Test Behavior, Not Implementation Details:**
  - ❌ *Fragile:* `expect(service['internalCounter']).toBe(3);`
  - ❌ *Fragile:* `expect(mockRepo.save).toHaveBeenCalledTimes(1);` (when asserting state result is sufficient)
  - ✅ *Robust:* `const item = await service.getItem(id); expect(item.status).toBe('COMPLETED');`

---

## 4. Determinism
- Unit tests must never depend on the order of execution.
- Tests must clean up state in `beforeEach` or `afterEach`.
- Do not make real network calls in unit test suites.
