---
title: "Niche Selection: Institutional Native-to-Flutter Decompilation"
epistemic_status: HYPOTHESIS_DRAFT
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Niche Selection: Institutional Native-to-Flutter Decompilation

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="HYPOTHESIS_DRAFT"] -->
## Niche Selection & Competitive Moat
- **Primary Beachhead**: High-growth mobile software houses and digital agencies migrating brownfield client codebases to Flutter.
- **Secondary Beachhead**: Security researchers and reverse engineers extracting UI hierarchies and API contracts from APK/AAB packages.
- **Value Vector**: Deterministic IR AST parsing rather than generic LLM code generation. Zero hallucinations on type contracts or layout bounds.
- **Defensibility**: Proprietary multi-format parsers (AXML, Smali/DEX, HAR, SQLite, Electron ASAR, SwiftUI, Tailwind JSX) emitting unified Flutter widgets.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
