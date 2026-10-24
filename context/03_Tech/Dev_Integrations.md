---
title: "External Toolchains & Native Integrations"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# External Toolchains & Native Integrations

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Integrated Toolchains
- **Android SDK & ADB**: Device connection, package pulling, and UI hierarchy dumping.
- **Dart SDK & Flutter CLI**: Automatic formatting and syntax verification.
- **Asar Unpacker**: Electron desktop app source code extraction.
- **Source Map Reconstructor**: Restores original TypeScript/JavaScript source trees from minified web bundles.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Android Debug Bridge (ADB) Inspection (`adb-device-analysis.md`)
- **Device Communication & Discovery**:
  - Leverages host `adb` platform tools without requiring global SDK installs; resolved via `PATH` or explicit `REA_ADB_PATH`.
  - Non-intrusive operations: inspects device capabilities, display metrics, running third-party packages, and window hierarchies (`dumpsys window displays`).
  - Package pulling: executes `pm path <package>` followed by `adb pull` to acquire APKs directly into local analysis staging directories.
  - UI state acquisition: captures live device screenshots (`screencap`) and view hierarchy XML (`uiautomator dump`) for real-time Flutter widget layout reconstruction.

### 2. Apple Application Projection (`apple-application-analysis.md`)
- **Bundle Inventory & Anatomy**:
  - Unpacks macOS `.app` bundles and iOS `.ipa` archives into structured component inventories.
  - Framework detection: identifies `Flutter.framework`, `React.framework`, `ReactNative.framework`, and `UnityFramework.framework`.
  - Content hashing (SHA-256) per resource to identify duplicate assets, asset catalogs (`Assets.car`), and localized strings (`Localizable.strings`).
  - Bridge candidate pairing: identifies paired JavaScript and native Mach-O binary targets to map inter-process bridge channels.

### 3. Electron & Web Runtime Deconstruction (`electron-observation.md`, `web-runtime.md`)
- **Electron ASAR Extraction**:
  - Unpacks `.asar` archives into plain directory structures using native streaming decoders.
  - Inspects Electron fuses (e.g., `RunAsNode`, `EnableNodeCliInspectArguments`) to determine debuggability.
  - Traces IPC communication channels between main and renderer processes (`ipcMain.handle`, `ipcRenderer.invoke`).
- **Web & Chrome DevTools Protocol (CDP)**:
  - Connects to browser instances via CDP to capture live DOM snapshots, computed styles, and network exchanges.
  - Restores formatted source code from embedded source maps (`sourceMappingURL`).
