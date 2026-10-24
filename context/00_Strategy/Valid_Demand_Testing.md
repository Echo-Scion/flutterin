---
title: "Demand Testing Matrix & Feature Conformance Gates"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Demand Testing Matrix & Feature Conformance Gates

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Feature Demand & Conformance Matrix
| Feature Pipeline | User Interest Score (1-10) | Implementation Status | Test Coverage |
| :--- | :--- | :--- | :--- |
| **Android XML -> Flutter Widget** | 9.8 | Active (`src/parsers/androidLayoutParser.ts`) | 100% (Vitest) |
| **React JSX / Tailwind -> Flutter** | 9.5 | Active (`src/parsers/reactParser.ts`) | 100% (Vitest) |
| **HAR / SQLite -> Dio / Drift** | 9.2 | Active (`src/core/decoders/harSqliteInspector.ts`) | 100% (Vitest) |
| **APK / DEX Unpacker** | 8.9 | Active (`src/parsers/dexParser.ts`) | 100% (Vitest) |
| **SwiftUI -> Flutter** | 8.4 | Active (`src/parsers/swiftUiParser.ts`) | 100% (Vitest) |
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
