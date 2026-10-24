---
title: "CLI Orchestration Engine & Process Lifecycle"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# CLI Orchestration Engine & Process Lifecycle

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Core Process Engine (`src/cli/`, `src/core/`)
- Node.js ESM architecture with high-speed async file I/O.
- Subprocess manager executing `adb`, `apktool`, `dart`, and native decompilers safely with configurable timeouts and error trapping.
- Graceful error recovery: Missing optional tools trigger informative doctor diagnostics instead of unhandled stack traces.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Native Binary Disassembly Engine (`ghidra-provider.md`, `ida-provider.md`)
- **Headless Ghidra Bridge**:
  - Spawns ephemeral Ghidra instances via `analyzeHeadless` in temporary workspaces with automatic socket IPC.
  - Non-destructive execution: analyzes binaries in read-only mode, emitting function dossiers, control-flow graphs (CFG), and decompiled C pseudocode without persisting DB mutations.
  - Address space and symbol resolution: parses standard `0x` hexadecimal representations, handles local thunks vs. resolved targets, and tracks memory-block read/write/execute permissions.
  - PDB debug symbol extraction: collects Program Information attributes (GUID, age, signature) for Windows binaries.
- **IDA Pro & Alternative Adapters**:
  - Fallback engine interface for IDA Pro and Radare2 when Ghidra is unavailable.
  - Maps external functions, thunk boundaries, and cross-references (`xrefs`) into canonical function models.

### 2. Dynamic Runtime Instrumentation (`frida-instrumentation.md`)
- **Frida Hooking Subsystem**:
  - Generates specialized Frida JavaScript agent snippets to attach to running Android/iOS/Desktop processes.
  - Intercepts Java/Kotlin methods (`Java.use()`) and native exports (`Interceptor.attach()`).
  - Automated network security bypass scripts (disabling standard OkHttp CertificatePinner and TrustManager checks) to enable clear-text HTTP archive capture.
  - Traces in-flight UI state mutations and sends JSON telemetries back to Flutterin CLI.

### 3. Safe Subprocess Management & Isolation
- **Process Security Mandate**:
  - All external tools (`adb`, `jadx`, `ghidra`, `frida`, `dart format`) are executed as strict argument vectors (`argv` array) via `child_process.spawn`. Shell evaluation (`shell: true`) is strictly forbidden to prevent command injection.
  - Enforces explicit execution deadlines (timeout ceiling: 60s for static tools, 180s for deep Ghidra analysis) with SIGTERM $\to$ SIGKILL escalation.
  - Automated directory cleanup: temp files, extracted APK archives, and decompiler workspaces are guaranteed clean via `try/finally` lifecycle hooks.
