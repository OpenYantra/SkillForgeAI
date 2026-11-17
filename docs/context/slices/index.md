# 🧭 SkillForgeAI Monorepo Domain Slice Router
*Token-Efficient Context Directory for AI Coding Agents. In monorepos (10,000+ files), load only the slice map needed for your current task.*

- **Generated At:** 2026-11-17T17:42:30.750Z
- **Total Slices:** 4
- **Monolithic Map Tokens:** ~1896 tokens
- **Average Slice Map Tokens:** ~255 tokens (**86.6% Token Savings**)

## 📦 Domain Slices Directory

| Domain / Slice | Root Directory | Primary Stack | Files | Est. Tokens | Dedicated Slice Map |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **dotnet-order-service** | `examples/dotnet-order-service` | csharp | 8 | ~278 | [dotnet-order-service-map.md](dotnet-order-service-map.md) |
| **order-service** | `examples/order-service` | typescript | 5 | ~234 | [order-service-map.md](order-service-map.md) |
| **cli** | `src/cli` | typescript | 9 | ~294 | [cli-map.md](cli-map.md) |
| **core** | `src/core` | typescript | 24 | ~214 | [core-map.md](core-map.md) |

---
> 💡 **Agent Instruction:** When implementing or debugging a feature in a specific domain, read the corresponding slice map above rather than loading the entire codebase or monolithic `REPO-MAP.md`.
