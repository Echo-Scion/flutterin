---
title: "Engineering Development Plan & Sprint Cadence"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Engineering Development Plan & Sprint Cadence

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Development Cadence & Quality Milestones
- **Sprint Cycle**: 2-week agile sprints backed by strict TDD.
- **Quality Gates**:
  - 100% unit test pass rate (`npm test` via Vitest).
  - Zero TypeScript compile errors (`npm run build` with `tsc --noEmit`).
  - Zero lint regressions in `.agents` verification (`python .agents/scripts/orion.py verify_agents`).
  - Evidence-backed verification (Exit Code 0 on all tool executions).
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
