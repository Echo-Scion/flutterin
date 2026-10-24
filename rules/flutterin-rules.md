# Flutterin Plugin Execution Rules & Guardrails

These rules are active whenever the `flutterin` plugin is enabled. They govern reverse-engineering procedures, decompilation safety, 6-Pillar orchestration, and Flutter code generation.

## 1. 6-Pillar Tool Selection & Zero-Dependency First
- **Built-in Decoders First**: When analyzing compiled Android APKs (`.apk`/`.aab`), Electron bundles (`.asar`), Source Maps (`.js.map`), network traces (`.har`), or SQLite databases (`.db`), always prioritize `flutterin`'s built-in zero-dependency decoders (`flutterin_decompile_mobile_package`, `flutterin_unpack_web_electron`, `flutterin_inspect_har_sqlite`).
- **Graceful Decompiler Fallbacks**: If external tools (`jadx`, `apktool`, `rizin`, `wabt`) are not installed on the host machine, never abort with an unhandled exception. Use the built-in pure-Python/TS decoders (AXML, ARSC, ASAR, SourceMap, ELF/PE/Mach-O/WASM parsers) and report diagnostic steps via `flutterin_doctor`.
- **Strict Fail-Fast on Corruption**: If binary parsing (`flutterin_analyze_binary`) or decompression reports file corruption or invalid headers, fail immediately with an explicit error. Never fabricate or hallucinate unverified symbol tables, methods, or class structures.

## 2. Flutter 3 & Dart 3 Code-Generation Guardrails
- **Modern Standards**:
  - Enforce sound null-safety (`?`, `!`, `late` used judiciously).
  - Use `const` constructors wherever possible to maximize render pipeline performance.
  - Apply Dart 3 patterns, switch expressions, and records for exhaustive JSON parsing and state decomposition.
- **State Management Conformance**:
  - NEVER generate raw `setState` inside widgets if the host workspace uses Riverpod, Bloc, or Provider.
  - Bind reconstructed widgets to the project's idiomatic consumers/controllers (`ConsumerWidget`, `BlocBuilder`, etc.).
- **Responsive Layout Design**:
  - Map native constraints (ConstraintLayout, AutoLayout, Flexbox) into idiomatic responsive Flutter widgets (`LayoutBuilder`, `MediaQuery`, `Expanded`, `Flexible`, `Wrap`).
  - Do NOT hardcode fixed pixel dimensions for screen containers; preserve fluid, multi-form-factor responsiveness.

## 3. Synergy with Official Antigravity "Dart and Flutter" Plugin
When generating or modifying Flutter source code under `lib/`, immediately orchestrate with the official Flutter plugin's skills and MCP tools:
- **Layout & Structure**: Follow `flutter-apply-architecture-best-practices` (UI, Logic, Data layers) and `flutter-build-responsive-layout`.
- **Navigation**: Map extracted routes into `go_router` via `flutter-setup-declarative-routing`.
- **Localization**: Output extracted multi-locale strings into `lib/l10n/app_<locale>.arb` files via `flutter-setup-localization`.
- **Native FFI**: When native C/C++/Rust libraries are extracted, configure `package:ffigen` and `hook/build.dart` via `dart-use-ffigen` and `dart-setup-ffi-assets`.
- **Verification & Hot Reload**: Audit reconstructed widgets using `flutter_a11y_agent` and verify zero errors via `flutter_dart-mcp-server` (`analyze_files`, `dart_fix`, `hot_reload` per `flutter-hot-reload.md`).

## 4. Honest 4-Tier Conversion Cascade & Conditional Vibe-Coding
- **Never Drop Silently**: Never drop unsupported or heavy native constructs into empty `Container()` widgets or silent mock placeholders.
- **4-Tier Classification**: Every extracted element must be assigned to its correct tier:
  - **Tier 1 (Pure Flutter)**: Primitives (Row, Column, Text, Button, Image, Slider, FAB).
  - **Tier 2 (Ecosystem Plugin)**: High-level platform components (`WKWebView` -> `webview_flutter`, `VideoPlayer` -> `video_player`, `Map` -> `google_maps_flutter`).
  - **Tier 3 (Hybrid Native Bridge)**: Background services, broadcast receivers, overlays -> `MethodChannel` Dart service + Kotlin/Swift host bridge scaffolds.
  - **Tier 4 (Custom Build / Escalation)**: Shaders, WebGL, custom Canvas rasterizers -> Trigger `INTERACTIVE_ESCALATION_REQUIRED`.
- **Conditional Vibe-Coding**:
  - If a screen contains only Tier 1, 2, or 3 components, proceed with seamless generation (`SEAMLESS_VIBE_CODING`).
  - If a screen contains Tier 4 components, halt automatic code drop, present concrete architecture options (Custom Painter, WebView embed, or native platform view), and wait for user confirmation.

## 5. Standalone vs. .agents Synergy Graceful Fallback
- **Ecosystem Check First**: Check if `.agents/` exists in the workspace.
- **When inside a `.agents` Portable-Brainvibing Workspace**:
  - Follow `.agents/canons/ecosystems/flutter/*` standards.
  - Stamp Project DNA (`.agents/.dna.json`) across the 5-Tier strata.
  - Sync the 82-file epistemic matrix under `context/`.
- **When running Standalone (No `.agents/`)**:
  - **NEVER** call `view_file` on non-existent `.agents/*` or `context/*` paths.
  - Apply self-contained built-in standards: standard 5-Tier clean directory structure (`lib/contracts`, `lib/domain`, `lib/services`, `lib/state`, `lib/presentation/screens`), Riverpod / ChangeNotifier UDF, and standard Dart 3 sound null-safety.
  - Do **not** create `.agents/` or `.dna.json` unless the user explicitly requested `--with-dna`.
  - If the Official Flutter Plugin MCP server is not installed, fallback gracefully to terminal commands: `flutter analyze`, `dart fix --apply`, `dart format .`, and `flutter test`.

## 6. Sovereign SharedPreferences Bridge & Feature-First DNA
- **Sovereign Bridge Mandate**: When Android `SharedPreferences` is detected, always output `FlutterPrefsReader.kt` bound to channel `"FlutterSharedPreferences"`. Never use the cold-start pattern `if (flutterPrefs.all.isNotEmpty()) { ... }` as a primary guard.
- **Dual Write**: Write bridge code to `native_bridges/android/` AND `android/app/src/main/kotlin/<pkg>/` if the `android/` directory exists in the output workspace.
- **Permission Gate Auto-Scaffold**: If `BIND_ACCESSIBILITY_SERVICE` or `SYSTEM_ALERT_WINDOW` capabilities are present in the manifest, automatically generate the `NativePermissionGateCard` Dart widget — never leave these as empty `Container()` stubs.
- **No Simulated Checks**: Kotlin permission handlers MUST use real `AccessibilityManager.getEnabledAccessibilityServiceList()` and `Settings.canDrawOverlays()` — never stub with `return true`.
- **Feature-First DNA Default**: DNA stratification defaults to Feature-First structure (`lib/features/*/domain/`, `lib/features/*/data/`, `lib/features/*/presentation/`) with backward-compatible flat-layer aliases. Never overwrite existing DNA without `--with-dna` flag.
- **ConstraintLayout Priority**: When resolving ConstraintLayout heuristics, explicit `constraintStart_toEndOf` / `constraintEnd_toStartOf` chains MUST map to `Row` before any Icon+Text+Control Card pattern check. Card is a chain-free fallback only.
