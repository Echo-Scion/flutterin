---
title: "Unit Testing Suite & Parser Verification"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Unit Testing Suite & Parser Verification

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Unit Testing Suite (Vitest)
- 20 comprehensive unit tests covering:
  - CLI command registration and option parsing.
  - React JSX and Tailwind CSS style resolution.
  - Android XML layout conversion to Flutter constraints.
  - HAR network inspector and Drift schema generation.
  - Diagnostic doctor profile evaluation.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Isolated Unit Test Architecture
- **In-Memory Parsers**:
  - All unit tests run against in-memory code snippets and mock AST fixtures without touching external processes or disk files.
  - Execution speed: sub-second completion for complete unit test suites (`node --test dist/tests/**/*.test.js`).
- **Parser Test Matrices**:
  - **React/Tailwind Parser**: Tests arbitrary combinations of Tailwind utilities (`flex`, `grid`, `space-x-4`, `p-6`, `rounded-2xl`, `shadow-md`, `border`, `hover:`, `dark:`), verifying precise conversion to Dart `BoxDecoration` and `EdgeInsets`.
  - **Android Layout Parser**: Tests deeply nested layouts with conflicting constraints, verifying correct conversion to `Row`, `Column`, `Stack`, and `Expanded`.
  - **JSON/HAR Inspector**: Tests parsing of malformed JSON, polymorphic arrays, nullable fields, and ISO timestamps into Freezed models.
  - **SQLite Introspector**: Tests table extraction, primary key detection, foreign key relationships, and custom SQLite types.

### 2. TDD & Regression Prevention
- **Strict TDD Contract**:
  - Every parser bug fix or new AST feature begins with a failing RED test fixture verifying the exact syntax edge case before implementation.
  - Code coverage gate: >=85% unit test coverage across parser and codegen modules.
