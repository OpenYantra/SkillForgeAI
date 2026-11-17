# Test Scenario Matrix Template

Use this matrix structure to ensure full coverage of functional requirements, edge cases, and boundary values.

---

## Scenario Checklist

| Category | Requirement Ref | Scenario Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **Happy Path** | `FR-001` | Valid entity creation with standard inputs | Returns created entity with unique ID & timestamps |
| **Happy Path** | `FR-002` | Valid state mutation (e.g. activation) | Status changes to ACTIVE, updatedAt timestamp updates |
| **Boundary** | `FR-001` | Input name at exact minimum length (1 character) | Creation succeeds |
| **Boundary** | `FR-001` | Input name at exact maximum length (e.g. 255 chars) | Creation succeeds |
| **Negative / Validation**| `FR-001` | Empty string `""` or whitespace `"   "` | Throws validation error; repository save not called |
| **Negative / Conflict**  | `EC-001` | Duplicate name submission | Throws `AlreadyExistsError`; no duplicate record created |
| **Negative / State**     | `EC-002` | Triggering action on invalid prior state (e.g., activating ARCHIVED) | Throws state transition error |
| **Resilience / Dependency**| `EC-003`| Repository rejects save with DB connection error | Service wraps and throws `InfrastructureError` cleanly |

---

## Test Code Template (Node.js / Vitest / Jest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureService, FeatureAlreadyExistsError } from '../services/feature.service.js';
import { InMemoryFeatureRepository } from '../repositories/in-memory-feature.repository.js';

describe('FeatureService', () => {
  let repository: InMemoryFeatureRepository;
  let service: FeatureService;

  beforeEach(() => {
    repository = new InMemoryFeatureRepository();
    service = new FeatureService(repository);
  });

  describe('createFeature', () => {
    it('should successfully create and persist feature with valid name (FR-001)', async () => {
      // Arrange
      const name = 'New Feature';

      // Act
      const result = await service.createFeature(name);

      // Assert
      expect(result).toBeDefined();
      expect(result.toJSON().name).toBe(name);
      expect(result.toJSON().status).toBe('PENDING');

      const saved = await repository.findById(result.toJSON().id);
      expect(saved).not.toBeNull();
    });

    it('should throw FeatureAlreadyExistsError when feature name already exists (EC-001)', async () => {
      // Arrange
      await service.createFeature('Billing Engine');

      // Act & Assert
      await expect(service.createFeature('Billing Engine'))
        .rejects
        .toThrow(FeatureAlreadyExistsError);
    });

    it('should reject creation when feature name is empty string (FR-001)', async () => {
      // Arrange
      const emptyName = '   ';

      // Act & Assert
      await expect(service.createFeature(emptyName))
        .rejects
        .toThrow();
    });
  });
});
```
