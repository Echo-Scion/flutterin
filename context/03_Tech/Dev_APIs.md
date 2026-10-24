---
title: "API Reverse Engineering & Model Codegen"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# API Reverse Engineering & Model Codegen

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Network Analysis Engine (`src/core/decoders/harSqliteInspector.ts`)
- Ingests HTTP Archive (`.har`) files captured via Charles Proxy, Proxyman, or Chrome DevTools.
- Infers strongly-typed Dart data structures from JSON request and response payloads.
- Generates complete Dio REST client service classes with error interceptors and authentication header handlers.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. MCP Server Tool Contracts & Envelopes
Flutterin exposes an institutional-grade Model Context Protocol (MCP) server conforming to the REA runtime specification:
- **Result Envelopes**: Evidence-producing tools return canonical records with:
  - `structuredContent.normalized_result`: The typed operation result.
  - `structuredContent.evidence_id`: Deterministic hash representing the observation.
  - `structuredContent.analysis_profile`: Concrete profile configuration.
  - `structuredContent.coverage`: Explicit `coverage.scope` (`root` or `container-entries`) and `coverage.status` (`complete` or `unknown`).
- **Standardized Error Contracts**:
  - Errors emit structured JSON envelopes matching `error-contract.schema.json`:
    ```json
    {
      "ok": false,
      "error_code": "RESOURCE_UNAVAILABLE | CAPABILITY_UNAVAILABLE | TARGET_NOT_FOUND",
      "message": "Human-readable diagnostic message",
      "remediation": "Prescribed CLI flag or environment variable fix",
      "limitations": ["Array of observed boundary constraints"]
    }
    ```
- **Retained Evidence & Paged Views**:
  - For high-volume observations (e.g., full APK inventories, symbol tables, HAR traces), tools support `detail: "summary"` returning linked summaries, and paged detail reads via `inspect_analysis_view` with `{offset, limit}` pagination.

### 2. Supported MCP Tools Catalog
1. `flutterin_convert_react`: Transpiles React/JSX/TSX component files into Flutter stateless/stateful widgets.
2. `flutterin_convert_web`: Converts HTML/CSS/Tailwind snippets into idiomatic Flutter layout trees.
3. `flutterin_convert_android`: Decompiles Android XML layouts or Compose functions into Flutter widgets.
4. `flutterin_convert_ios`: Transpiles SwiftUI or Storyboard hierarchies into Flutter equivalents.
5. `flutterin_generate_models`: Ingests JSON/HAR/SQLite schema and emits Freezed + JSON Serializable Dart data models.
6. `flutterin_analyze_binary`: Probes AOT snapshots, Mach-O headers, and ELF shared libraries for Dart symbols and API endpoints.
7. `flutterin_doctor`: Probes host toolchain dependencies (Node, Dart, ADB, JADX, Ghidra).

### 3. CLI Command Grammar
The CLI mirrors the MCP tools for headless shell operations:
```bash
# Code conversion
flutterin react ./src/components/UserProfile.tsx -s UserProfileScreen -o ./lib/features/profile/user_profile_screen.dart
flutterin android ./app/src/main/res/layout/activity_main.xml -s MainScreen -o ./lib/views/main_screen.dart

# API, HAR, and SQLite inspection/codegen
flutterin api ./payload.json -m UserApi -u https://api.example.com/users -o ./lib/models/user_api.dart
flutterin inspect ./traffic.har
flutterin inspect ./app.db

# Inspection & Diagnostics
flutterin doctor -p full
flutterin binary ./libapp.so
```
