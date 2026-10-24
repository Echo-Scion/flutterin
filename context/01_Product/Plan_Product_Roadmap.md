---
title: "Comprehensive Product Roadmap & Release Cycles"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Comprehensive Product Roadmap & Release Cycles

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Engineering Release Horizons
- **v1.0.0 (Core Transpiler)**: Full CLI release with Android XML, Web Tailwind, React JSX, SwiftUI, HAR, SQLite, and MCP server.
- **v1.1.0 (Deep Binary Bridge)**: Advanced AOT binary symbol extraction, automated SSL pinning bypass generation, and live ADB device inspection.
- **v1.2.0 (Interactive GUI & Diff View)**: Desktop UI previewing side-by-side transpiled Flutter widgets against source screens.
- **v2.0.0 (Enterprise Migration Suite)**: Monorepo full-codebase translation with automated test suite synthesis.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Phased Product Milestones
- **Phase 1: Zero-Engine Static Analysis & Code Transpilation**
  - Pure TypeScript/Babel AST parsing of React/Next.js/Tailwind components into Flutter widgets.
  - SQLite schema introspection and HAR network archive parsing to Freezed/Dio services.
  - Headless Android XML layout to `Row`, `Column`, `Stack`, `Container` conversion.
  - Initial MCP server interface with `flutterin_*` tools.
- **Phase 2: Mobile & AOT Binary Inspection**
  - Dart AOT snapshot identification (`identify-flutter-build` and `inspect-dart-aot` for `libapp.so`).
  - Headless JADX integration for APK decompression and Dex bytecode disassembly.
  - Apple IPA/.app framework graph projection and bridge candidate extraction.
  - ADB live device interaction: display metrics, view hierarchy dumping, package pulling, and screenshot capture.
- **Phase 3: Deep Native Decompilation Providers**
  - Headless Ghidra provider integration for C/C++ native shared objects (`.so`, `.dylib`, `.dll`).
  - IDA Pro and Frida dynamic hook generators to trace in-flight method parameters.
  - Cross-architecture support (x86_64, arm64-v8a, armeabi-v7a).
- **Phase 4: Synthesis & Clean-Room Flutter Code Generation**
  - IR Layout Optimizer reconciling nested Flex/Constraint systems into canonical Flutter widget trees.
  - Riverpod 2.x and BLoC state binding generation from decompiled UI event handlers.
  - Golden test generation and side-by-side visual diff verification suite.
