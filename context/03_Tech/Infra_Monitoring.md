---
title: "Diagnostics, Health Checks, and Telemetry"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Diagnostics, Health Checks, and Telemetry

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## System Diagnostics (`flutterin doctor`)
- Verifies existence and PATH availability of:
  - Node.js runtime and npm
  - Dart SDK and Flutter installation
  - Android SDK and ADB platform tools
  - Java / JDK 17+ environment
  - Optional decompilation utilities (apktool, jadx)
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
