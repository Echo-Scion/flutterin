# MEMORY: Strategic & Architectural Decisions

> **Persistent Strategic Memory (Pillar: 00_Strategy)**
> Records immutable architectural axioms and design choices for `flutterin`.

---

## 1. Foundational Axioms

1. **Flutterin is NOT a Flutter app repository**:
   - `flutterin` itself is written in **TypeScript / Node.js**.
   - Its mission is to transform external codebases, layouts, APIs, and binaries into production-grade Flutter code.
2. **Intermediate Representation (IR) Supremacy**:
   - Never transpile source syntax directly to target strings.
   - All input parsers must first emit a type-safe `UnifiedWidgetNode` AST representation before the Dart emitter runs.
3. **Restrained, Clean-Architecture Output**:
   - The emitted Dart code must always adhere to Feature-First Clean Architecture (`features/<feature>/presentation|domain|data`).
   - Default state management is strictly Riverpod 2.x with code generation.
   - Default data models are strictly Freezed immutable classes.
4. **Zero-Fingerprint & Clean Room**:
   - Decompiled or converted logic must be reconstructed cleanly without proprietary third-party branding or leaked artifacts.

---

## 2. Decision Log

- **2026-10-14**: Workspace initialized as Node.js / TypeScript engine.
- **2026-10-14**: Native MCP tools configured (`flutterin_doctor`, `flutterin_convert_*`, `flutterin_generate_models`, `flutterin_analyze_binary`).
- **2026-10-14**: Standardized on pure Python/SQLite local Orion Brain Graph for knowledge persistence.
