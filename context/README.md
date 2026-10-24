# 🧭 Context Atlas: Flutterin Engine

Welcome to the central knowledge repository for **Flutterin Engine** (`flutterin`).

This directory houses the business, product, creative, and technical knowledge for the Flutterin universal conversion engine. It is organized according to the **4 Lean Pillars** architectural standard.

---

## 🏛️ The 4 Lean Pillars

```text
context/
├── AGENT_IDENTITY.md         # Behavioral compact, agent persona, and domain mandates
├── README.md                 # Master Context Atlas (this file)
├── 00_Strategy/
│   ├── BLUEPRINT.md          # [MASTER] Vision, problem discovery, market dynamics, and scope
│   └── MEMORY.md             # [LIVING] Strategic project memory, axioms, and milestones
├── 01_Product/
│   └── ROADMAP.md            # [MASTER] Product roadmap, converter milestones, and anti-goals
├── 02_Creative/
│   └── STYLE_GUIDE.md        # [MASTER] Target Flutter design system, tokens, and Riverpod contracts
└── 03_Tech/
    └── ARCHITECTURE.md       # [MASTER] Node.js/TypeScript pipeline, AST intermediate representation, and MCP servers
```

---

## ⚡ JIT (Just-In-Time) Expansion Protocol

To prevent context bloat, only the **4 Master Files** exist initially. When deep focus is required for a specific sub-domain, create the granular detail file using the official prefixes:

| Pillar | Sub-Domain Focus | Allowed Prefixes | Examples |
| :--- | :--- | :--- | :--- |
| **`00_Strategy/`** | Idea, Validation, Scaling | `Idea_`, `Valid_`, `Scale_` | `Idea_Transpiler_Benchmarks.md` |
| **`01_Product/`** | Planning, Launch, Growth | `Plan_`, `Launch_`, `Data_` | `Plan_React_Converter_Spec.md` |
| **`02_Creative/`** | Design, UX, Tokens | `Design_` | `Design_Material3_Tokens.md` |
| **`03_Tech/`** | Dev, Infra, Testing | `Dev_`, `Infra_`, `Test_` | `Dev_AST_Transformer.md` |

---

## 🔗 Context & Graph Storage
- **Machine Knowledge Graph**: `.orion/orion.db` (Indexed via `python .agents/scripts/orion.py orion_ops ingest context/`)
- **Compiled Rule Matrices**: `.orion/matrix/`
- **Agent Rules & Protocols**: `.agents/rules/`
