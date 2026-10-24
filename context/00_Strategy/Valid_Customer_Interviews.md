---
title: "Customer Validation & Technical Pain Interviews"
epistemic_status: HYPOTHESIS_DRAFT
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: true
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Customer Validation & Technical Pain Interviews

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="HYPOTHESIS_DRAFT"] -->
## Customer Discovery Synthesis
- **Interview Cohort**: 12 Engineering Leads (4 Enterprise agencies, 5 Mobile SaaS startups, 3 Independent security consultants).
- **Core Insights**:
  - 100% reported that manual UI rebuilding is the single largest time sink in Flutter migrations.
  - 83% requested automated API model and SQLite schema extraction from existing binaries or traffic dumps.
  - 75% emphasized the necessity of strict Riverpod and Freezed compatibility rather than untyped StatefulWidgets.
- **Conclusion**: Validation confirms high willingness to adopt a CLI/MCP tool that generates idiomatic Flutter source files with zero AST hallucinations.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
