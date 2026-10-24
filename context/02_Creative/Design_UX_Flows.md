---
title: "UX Navigation Flows & Screen Hierarchy"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# UX Navigation Flows & Screen Hierarchy

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Operational User Journeys
```mermaid
flowchart TD
    Start([CLI Command Invoked]) --> Parse[Parse Source AST]
    Parse --> Validate{Valid AST?}
    Validate -- No --> Warn[Emit Diagnostics & Fallback Widget]
    Validate -- Yes --> IR[Transform to Unified IR]
    IR --> Dart[Emit Idiomatic Dart 3]
    Dart --> Format[Execute dart format]
    Format --> Done(["Output Ready in lib/"])
```
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
