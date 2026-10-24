---
title: "Problem Discovery: Mobile & Web to Flutter Transpilation Friction"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Problem Discovery: Mobile & Web to Flutter Transpilation Friction

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Executive Problem Discovery
- **Core Friction**: Engineering teams face prohibitive costs (averaging $120k+ and 4-6 months per app) when migrating legacy native mobile (Java/Kotlin/Swift) or React/Web applications to Flutter 3.
- **Transpiler Deficiencies**: Legacy converters use naive regex replacements, resulting in uncompilable Dart code, unhandled layout constraints (RenderFlex overflows), and missing state bindings.
- **Binary Reverse Engineering Barrier**: Companies maintaining lost-source mobile assets or legacy APKs have zero automated tooling to reconstruct clean, idiomatic Flutter source code from bytecode or layout XML.
- **The Flutterin Solution**: AST-driven Intermediate Representation (IR) mapping that deterministically decompiles, parses, and emits clean Flutter 3 / Dart 3 code with Riverpod 2.x and Freezed models.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
