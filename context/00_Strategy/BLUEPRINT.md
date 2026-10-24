# BLUEPRINT: Flutterin Engine

> **Master Strategic Atlas (Pillar: 00_Strategy)**
> Universal transpilation, AST conversion, and reverse-engineering pipeline to Flutter.

---

## 1. Context & Core Intent

- **System Name**: Flutterin Engine (`flutterin`)
- **Node Identifier**: `FLUTTERIN_CORE_V1`
- **Trinity of Identity**: `Universal Transpiler`, `Deterministic Codegen`, `High-Craft Flutter`
- **Core Intent**: Build an institutional-grade, Node.js/TypeScript-powered universal engine and MCP server suite that deterministically parses, decompiles, and converts any codebase, layout, schema, or binary into idiomatic, production-ready Flutter code.

---

## 2. Problem Statement & Market Gap

1. **Manual Porting Friction**: Migrating existing applications (React, Next.js, Android XML, Jetpack Compose, iOS SwiftUI) to Flutter requires manual line-by-line translation of layout, styling, and state logic.
2. **Brittle Heuristic Scrapers**: Existing converters rely on fragile regex string replacement that generates unmaintainable, broken Dart code with syntax errors and styling regressions.
3. **Black-Box Binary Reconstruction**: When source code is unavailable, reverse-engineering mobile apps or web assemblies to Flutter requires deep manual decompilation without structured AST intermediate representations (IR).
4. **Architectural Slop**: Auto-generated code often disregards production design patterns, creating massive stateful widgets instead of clean feature-first architecture with immutable models.

---

## 3. The Unfair Advantage

- **Unified Intermediate Representation (IR)**: Decouples input parsers (React JSX, Web HTML/CSS, Android XML, Native AST) from the Dart code emission layer.
- **Production-Grade Flutter Output**: Emits strict Feature-First Clean Architecture, Riverpod 2.x state management, and Freezed immutable models.
- **Deep MCP Protocol Integration**: Natively registers specialized agentic tools (`flutterin_convert_react`, `flutterin_convert_web`, `flutterin_convert_android`, `flutterin_convert_ios`, `flutterin_generate_models`, `flutterin_analyze_binary`, `flutterin_doctor`).
- **Binary Deconstruction Bridge**: Synthesizes AST binary extraction techniques to analyze compiled artifacts and reconstruct clean-room Flutter implementations.

---

## 4. Scope Distillation

### MVP Scope (Active)
- TypeScript/Node.js AST transformation engine.
- React JSX/TSX to Flutter Widget AST mapping (Flexbox, Tailwind, CSS styles to Flutter Layout & BoxDecoration).
- JSON/Schema to Freezed and `@riverpod` Dart model generation.
- Full MCP Server integration exposing conversion tools to AI pair programmers.
- Automated `dart format` and syntax verification gate.

### Peak Scope (Roadmap)
- Android XML & Jetpack Compose to Flutter transpilation.
- iOS Storyboard & SwiftUI to Flutter transpilation.
- Native binary deconstruction & clean-room logic reconstruction.
- Interactive side-by-side AST visualizer and widget diff inspector.

---

## 5. Decompilation & Reverse Engineering Philosophy (REA Integration)

Drawing from the Reverse Engineer Anything (REA) specification:
1. **Evidence-Based Reconstruction**: Every decompiled artifact produces an authenticated Evidence record (`evidence_id`, `normalized_result`, `analysis_profile`, `coverage.scope`, `coverage.status`).
2. **Deterministic Primitives vs. Workflows**: Deconstruction tools are exposed as composable primitives (`inspect`, `search`, `trace`, `compare`, `observe`). High-level conversion workflows consume these primitives without hiding intermediate uncertainties.
3. **Multi-Target Ingestion Matrix**:
   - **Android / DEX**: Headless JADX bridge for Java/Kotlin decompilation and resource decoding.
   - **iOS / Mach-O**: Framework inventory projection for IPA and `.app` bundles, extracting UI assets and bridge hypotheses.
   - **Flutter AOT**: Direct `libapp.so` parsing via dynamic symbol table (`_kDart*Snapshot*` symbols, FullAOT snapshot header parsing, and Dart VM hash identification).
   - **Native Binaries**: Headless Ghidra / IDA Pro bridge for C/C++ disassembly and function dossier extraction.
   - **Data & Network**: Local SQLite snapshot analysis and HAR/PCAP network packet inspection for strongly-typed model generation.
4. **Single-Writer Safety**: The conversion engine acts strictly as an analytical probe and code synthesizer, leaving target binary artifacts unmodified.

---

## 6. Granular Detail References (JIT Child Mapping)
- `Idea_` — Market research and converter capability mappings (e.g., `Idea_Transpiler_Benchmarks.md`).
- `Valid_` — Conformance testing and golden widget comparison (e.g., `Valid_Golden_Layouts.md`).
- `Scale_` — Multi-file monorepo porting pipelines (e.g., `Scale_Enterprise_Migration.md`).
