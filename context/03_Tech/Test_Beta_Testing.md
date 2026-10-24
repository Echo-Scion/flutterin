---
title: "Beta Conformance & Community Validation Gates"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Beta Conformance & Community Validation Gates

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Quality Conformance Gates
- 100% of generated Dart files must pass `dart format` without errors.
- Generated code must conform to Flutter 3 and Dart 3.x modern syntax (records, pattern matching, sealed classes).
- Zero deprecation warnings on generated Riverpod and Freezed annotations.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
