<!-- skillforge-slice: cli -->
# Vertical Slice: `cli`
> **Est. Tokens:** ~347 | **Root:** `src/cli` | **Stack:** typescript | **Files:** 7

### 🏛️ Architecture & Exported Symbols
- **Domain Entities:** None
- **Ports / Interfaces:** `I`
- **Application Services:** None
- **Persistence & Adapters:** None
- **Commands & Handlers:** `getGitChangedFiles`, `getDiffForFile`, `classifyChanges`, `executeDiff`, `executeGate`, `scanFiles`, `detectLanguage`, `extractSymbolsAndImports`, `buildMermaidDiagram`, `buildCodeGraph`, `generateRepoMapMarkdown`, `executeGraph`, `toPascalCase`, `toCamelCase`, `generateTypeScriptTemplates`, `generateDotnetTemplates`, `executeScaffold`, `getCurrentGitSha`, `executeSignoff`, `hasSourceFiles`, `discoverSlices`, `classifySliceSymbols`, `analyzeSlice`, `renderSliceMap`, `renderSliceIndex`, `generateSliceMaps`, `executeSlice`, `printBanner`, `printSection`, `printSuccess`, `printError`, `printWarning`, `printInfo`
- **Additional Components:** `InMemory`

### 🔗 Cross-Slice Dependencies
- **Inbound Dependents:** None (Self-contained root slice)
- **Outbound Imports:** None (Zero external slice dependencies)

### 🧪 Test Suite
- *No tests registered directly in slice root.*

### 🛡️ Architectural Conformance
- **Clean Architecture & Vertical Slice:** Domain logic decoupled from infrastructure.
- **Boundary Isolation:** Repository interfaces abstracted behind ports.
