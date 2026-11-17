<!-- skillforge-slice: cli -->
# Vertical Slice: `cli`
> **Est. Tokens:** ~315 | **Root:** `src/cli` | **Stack:** typescript | **Files:** 10

### 🏛️ Architecture & Exported Symbols
- **Domain Entities:** None
- **Ports / Interfaces:** None
- **Application Services:** None
- **Persistence & Adapters:** None
- **Commands & Handlers:** `executeDiff`, `executeGate`, `executeGraph`, `toPascalCase`, `toCamelCase`, `generateTypeScriptTemplates`, `generateDotnetTemplates`, `executeScaffold`, `executeSecurity`, `getCurrentGitSha`, `executeSignoff`, `hasSourceFiles`, `discoverSlices`, `classifySliceSymbols`, `analyzeSlice`, `renderSliceMap`, `renderSliceIndex`, `generateSliceMaps`, `executeSlice`, `toPosix`, `normalize`, `firstDifference`, `listMapFiles`, `checkContextArtifacts`, `printBanner`, `printSection`, `printSuccess`, `printError`, `printWarning`, `printInfo`, `printValidatorReport`, `runValidatorCli`

### 🔗 Cross-Slice Dependencies
- **Inbound Dependents:** `Root / External`
- **Outbound Imports:** `core`

### 🧪 Test Suite
- *No tests registered directly in slice root.*

### 🛡️ Architectural Conformance
- **Clean Architecture & Vertical Slice:** Domain logic decoupled from infrastructure.
- **Boundary Isolation:** Repository interfaces abstracted behind ports.
