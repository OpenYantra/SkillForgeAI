<!-- skillforge-slice: order-service -->
# Vertical Slice: `order-service`
> **Est. Tokens:** ~234 | **Root:** `examples/order-service` | **Stack:** typescript | **Files:** 5

### 🏛️ Architecture & Exported Symbols
- **Domain Entities:** `DomainValidationError`, `InvalidStateTransitionError`, `OrderEntity`, `OrderItem`, `OrderProps`
- **Ports / Interfaces:** `IOrderRepository`
- **Application Services:** `OrderService`
- **Persistence & Adapters:** `InMemoryOrderRepository`
- **Domain Errors / Exceptions:** `OrderNotFoundError`

### 🔗 Cross-Slice Dependencies
- **Inbound Dependents:** None (Self-contained root slice)
- **Outbound Imports:** None (Zero external slice dependencies)

### 🧪 Test Suite
- `examples/order-service/tests/order.service.spec.ts`

### 🛡️ Architectural Conformance
- **Clean Architecture & Vertical Slice:** Domain logic decoupled from infrastructure.
- **Boundary Isolation:** Repository interfaces abstracted behind ports.
