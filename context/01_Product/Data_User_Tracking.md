---
title: "Local-First Anonymous Telemetry & Opt-In Diagnostics"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Local-First Anonymous Telemetry & Opt-In Diagnostics

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Privacy-Respecting Telemetry
- Strictly opt-in: `flutterin --telemetry=on`. Zero code snippets, tokens, or paths are ever transmitted.
- Only counts anonymous command execution success/failure rates and parser performance durations to identify syntax bottlenecks.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
