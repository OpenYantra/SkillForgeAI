<!-- skillforge-slice: core -->
# Vertical Slice: `core`
> **Est. Tokens:** ~214 | **Root:** `src/core` | **Stack:** typescript | **Files:** 24

### 🏛️ Architecture & Exported Symbols
- **Domain Entities:** None
- **Ports / Interfaces:** None
- **Application Services:** None
- **Persistence & Adapters:** None
- **Additional Components:** `runGit`, `tryGit`, `splitLines`, `getGitChangedFiles`, `getDiffForFile`, `classifyChanges`, `loadCachedGraph`, `analyzeDiff`

### 🔗 Cross-Slice Dependencies
- **Inbound Dependents:** `Root / External`, `cli`
- **Outbound Imports:** None (Zero external slice dependencies)

### 🧪 Test Suite
- *No tests registered directly in slice root.*

### 🛡️ Architectural Conformance
- **Clean Architecture & Vertical Slice:** Domain logic decoupled from infrastructure.
- **Boundary Isolation:** Repository interfaces abstracted behind ports.
