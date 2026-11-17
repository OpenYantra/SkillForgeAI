# Clean Architecture & Layering Rules for Coding Agents

When scaffolding code, coding agents should follow strict dependency boundaries to ensure maintainability, testability, and adherence to SOLID principles.

---

## 1. The Dependency Inversion Rule
**High-level modules should not depend on low-level modules; both should depend on abstractions.**

```text
Controllers / Routes (Web Framework)
         ↓
Services / Use Cases (Application Rules)
         ↓
Domain Entities & Ports (Pure Business Logic)
         ↑
Repositories / DB Adapters (Infrastructure Implementation)
```

- **Domain Layer:** Has 0 external framework dependencies (no Express, Nest, Fastify, Prisma, TypeORM).
- **Service Layer:** Depends solely on domain interfaces (`IPort`, `IRepository`).
- **Infrastructure Layer:** Implements interfaces declared by the domain layer.
- **Presentation Layer:** Ingests external HTTP requests, validates DTOs, and invokes services.

---

## 2. Standard Folder Structure per Feature / Slice

For modular monoliths or vertical slice architectures, organize code by domain capability:

```text
src/features/<feature-name>/
├── domain/
│   ├── entities/          # Pure entity classes & business logic
│   ├── ports/             # Repository and client interfaces
│   └── value-objects/     # Immutable value objects
├── services/              # Application use cases / orchestration
├── repositories/          # DB / Cache persistence implementations
├── controllers/           # HTTP routes, request/response handlers
└── dto/                   # Request/response validation schemas (Zod/Joi)
```

---

## 3. Error Handling Mandates

- **Never throw generic `new Error('failed')`.**
- Define domain-specific errors extending a common base:
  - `DomainValidationError`
  - `ResourceNotFoundError`
  - `ConflictError`
  - `ForbiddenError`
- The presentation layer maps domain error classes into standard HTTP status codes.
