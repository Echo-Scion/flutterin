---
title: "Production Tech Stack & Architectural Justification"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Production Tech Stack & Architectural Justification

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Technology Stack Specification
- **Language / Runtime**: Node.js 20+ (ESM), TypeScript 5.4+.
- **CLI Framework**: Commander.js with Chalk, Ora spinners, and Inquirer.
- **AST Parsing Engines**:
  - `@babel/parser`, `@babel/traverse`, `@babel/types` (React JSX / TSX / JavaScript).
  - Custom Binary AXML & XML DOM Parser (Android Layouts & Manifests).
  - Sqlite3 Native Parser (SQLite Schemas & Sample Rows).
  - Tree-Sitter & Regex Lexers (SwiftUI & Native Binaries).
- **Code Emission**: Custom AST Dart Emitter with automated `dart format` spawn.
- **Protocol**: Model Context Protocol (MCP) SDK v1.0.4 over stdio.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Host Runtime & Core Dependencies
- **Runtime Environment**:
  - Node.js ESM (`type: "module"`), TypeScript 5.8+ compiled via `tsc`.
  - `@modelcontextprotocol/sdk`: Official MCP SDK implementing the Model Context Protocol standard over `stdio`.
  - `commander`: Typed CLI command-line runner and argument validator.
  - `fast-xml-parser`: High-speed streaming XML decoder for Android layout and manifest files.
  - `chalk`: High-visibility ANSI terminal formatting.
  - Native `node:sqlite` (`DatabaseSync`): Zero-dependency local SQLite schema and row inspector.

### 2. External Subprocess Adapters
- **Android Toolchain**: `adb` for live device interrogation; `jadx-headless-mcp` for DEX decompilation.
- **Binary Toolchain**: Headless `ghidra` (`analyzeHeadless`), IDA Pro adapter, `frida-tools`.
- **Flutter Toolchain**: Dart SDK CLI (`dart format`, `dart analyze`, `flutter test`).

### 3. Target Emitted Code Stack (Production Flutter 3.x)
- **State Management**: `flutter_riverpod` 2.x with code generation (`@riverpod`).
- **Data Modeling**: `freezed` & `json_annotation` for immutable data classes and union types.
- **Persistence**: `drift` ORM with SQLite for structured local databases.
- **Networking**: `dio` with custom interceptors for authentication and request caching.
- **Architecture**: Strict Feature-First Clean Architecture (`lib/features/<feature>/{data,domain,presentation}`).
