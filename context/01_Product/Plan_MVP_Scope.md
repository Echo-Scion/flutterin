---
title: "MVP Scope Definition & Hard Boundaries"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# MVP Scope Definition & Hard Boundaries

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## MVP Bound Invariants
- **Included in v1.0.0**:
  - Full CLI with 15 commands (`doctor`, `setup`, `mcp`, `mobile`, `adb`, `unpack`, `inspect`, `android`, `web`, `react`, `ios`, `api`, `binary`, `interceptor`, `context`).
  - Strict AST IR parsing with zero regex-based string replacements.
  - Riverpod 2.x and Freezed model generation.
  - MCP tool registration over stdio.
- **Explicitly Excluded from MVP**:
  - Proprietary cloud-hosted code storage (CLI is 100% local-first).
  - Closed-source obfuscators.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
