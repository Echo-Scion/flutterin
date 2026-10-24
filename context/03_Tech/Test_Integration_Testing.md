---
title: "End-to-End Integration Tests"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# End-to-End Integration Tests

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Integration Testing Pipeline
- Real-world APK deconstruction and widget generation test suite.
- Live React Tailwind sample conversion verified with `dart analyze`.
- Full MCP stdio request/response verification.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Integration Verification Lanes (`testing.md`)
- **Focused Execution**:
  - `npm run test:boundary`: Tests MCP stdio JSON-RPC protocol boundaries, CLI argument parsing, and process isolation.
  - `npm run test:acceptance`: End-to-end acceptance workflows converting full React/Next.js repositories and Android APK fixtures into Flutter projects.
  - Non-zero test count guarantee: test suites fail with Exit Code 1 if zero tests were executed in an explicit selection.
- **Compiler & Dart Verification Gate**:
  - Every generated Flutter code artifact is piped through `dart format --output=none --set-exit-if-changed` and `dart analyze --fatal-infos`. Any syntax ambiguity, unhandled import, or type mismatch halts the test suite.

### 2. Client & Agent Verification (`client-verification.md`)
- **MCP Client Compatibility**:
  - Verifies stdio handshakes with Antigravity, Claude Code, Cursor, and Gemini CLI.
  - Confirms tool schema publication without truncation.
  - Validates cancellation handling: tests simulate client abort signals during deep analysis, verifying graceful subprocess termination and exit code reporting.

### 3. Reconstruction Coverage Gates (`reconstruction-coverage.md`)
- **AST Equivalence Verification**:
  - Compares input AST layout nodes with emitted Flutter widget AST trees.
  - Validates that every flex/grid property (direction, alignment, gap, padding, margin, border, background) has an exact counterpart in the Flutter widget tree.
- **Golden Widget Test Generation**:
  - Automatically synthesizes `testWidgets()` test files that render the emitted widget against golden snapshot targets to verify pixel-accurate layout reproduction.
