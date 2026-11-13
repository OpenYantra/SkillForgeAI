<!-- skillforge-slice: dotnet-order-service -->
# Vertical Slice: `dotnet-order-service`
> **Est. Tokens:** ~278 | **Root:** `examples/dotnet-order-service` | **Stack:** csharp | **Files:** 8

### 🏛️ Architecture & Exported Symbols
- **Domain Entities:** `Order`, `OrderItem`
- **Ports / Interfaces:** `IOrderRepository`
- **Application Services:** `OrderApplicationService`
- **Persistence & Adapters:** `InMemoryOrderRepository`
- **Domain Errors / Exceptions:** `DomainValidationException`, `InvalidStateTransitionException`, `OrderNotFoundException`
- **Additional Components:** `OrderServiceTests`, `Program`

### 🔗 Cross-Slice Dependencies
- **Inbound Dependents:** None (Self-contained root slice)
- **Outbound Imports:** None (Zero external slice dependencies)

### 🧪 Test Suite
- `examples/dotnet-order-service/tests/OrderService.Tests/OrderServiceTests.cs`
- `examples/dotnet-order-service/tests/OrderService.Tests/Program.cs`

### 🛡️ Architectural Conformance
- **Clean Architecture & Vertical Slice:** Domain logic decoupled from infrastructure.
- **Boundary Isolation:** Repository interfaces abstracted behind ports.
