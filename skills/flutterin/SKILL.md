---
name: flutterin
description: Orchestrates full-spectrum reverse engineering across Android, iOS, Web, Electron, HAR, SQLite, and Native Binaries into clean Flutter 3 / Dart 3 codebases using the 6-Pillar flutterin suite.
---

# Flutterin Full-Spectrum Reverse Engineering Pipeline

This skill guides the agent through deconstructing any compiled binary, package, capture, or source repository and reconstructing clean, idiomatic Flutter 3 / Dart 3 applications using the 6-Pillar `flutterin` suite and the Official Antigravity `Dart and Flutter` Plugin.

## 6-Pillar Tool Suite

| Tool | Pillar | Target Artifacts & Purpose |
| :--- | :---: | :--- |
| `flutterin_doctor` | All | Reports 6-Pillar health, decompiler availability, and Antigravity plugin synergy. |
| `flutterin_decompile_mobile_package` | 1 & 5 | Ingests `.apk`, `.aab`, `.dex`, `.ipa` $\rightarrow$ decodes AXML/Plist, layouts, strings (`.arb`), models. |
| `flutterin_adb_inspect_live` | 5 | Connects to Android device via ADB: list devices, dump live UI hierarchy, pull installed APK. |
| `flutterin_unpack_web_electron` | 4 | Ingests Electron `.asar` bundles or `.js.map` Source Maps $\rightarrow$ reconstructs original sources. |
| `flutterin_inspect_har_sqlite` | 1 & 4 | Ingests `.har` captures into REST contracts, or inspects `.sqlite`/`.db` into Drift schemas & entities. |
| `flutterin_analyze_binary` | 1 & 6 | Ingests Flutter AOT (`libapp.so`) or ELF, PE, Mach-O, WASM binaries $\rightarrow$ generates Dart FFI stubs. |
| `flutterin_generate_context` | 1 & 4 | Scans source/decompiled assets $\rightarrow$ populates .agents 82-file context matrix with epistemic tags. |
| `flutterin_reverse_flutter_to_context` | 1 & 5 | Reverse-engineers Flutter apps (APK/IPA/libapp.so) $\rightarrow$ synthesizes full 82-file context matrix. |
| `flutterin_convert_android` | 1 & 2 | Converts Android XML (text or binary AXML) or Jetpack Compose into Flutter Widgets. |
| `flutterin_convert_ios` | 2 | Converts iOS SwiftUI Views and Storyboard declarations into Flutter Widgets. |
| `flutterin_convert_web` | 2 & 4 | Converts HTML + Tailwind CSS views into responsive Flutter Widgets. |
| `flutterin_convert_react` | 2 & 4 | Converts React Native / React JSX components into responsive Flutter Widgets. |
| `flutterin_generate_models` | 1 & 4 | Generates null-safe immutable Dart 3 models with pattern matching and Dio API client. |
| `flutterin_list_engines` | 1 | Queries the SQLite 677+ Flutter Engine catalog by snapshot hash or commit ID. |
| `flutterin_generate_interceptor` | 5 | Generates a Frida runtime SSL verification bypass script for HTTPS traffic capture. |

---

## Specialized Domain References

For deep, domain-specific runbooks, load the target reference file in `references/`:

- **Mobile Application Decompilation (APK, AAB, DEX, IPA)**: Read [references/mobile-decompile.md](references/mobile-decompile.md)
- **Web & Electron Reconstruction (.asar, .js.map, React, Web)**: Read [references/web-reconstruct.md](references/web-reconstruct.md)
- **Network Traffic & Database (.har, SQLite .db)**: Read [references/traffic-database.md](references/traffic-database.md)
- **Native Binary & Flutter AOT (ELF, PE, Mach-O, WASM, libapp.so)**: Read [references/binary-ffi.md](references/binary-ffi.md)

---

## 4-Phase Execution Pipeline

### Phase 1: Diagnostic & Target Ingestion
1. **Pillar Readiness**:
   - Run `flutterin_doctor` to verify available providers.
2. **Target Ingestion**:
   - **Android APK / AAB**: Call `flutterin_decompile_mobile_package` (Runbook: [references/mobile-decompile.md](references/mobile-decompile.md)).
   - **Live Android App**: Call `flutterin_adb_inspect_live` (`dump_ui_hierarchy` or `pull_apk`).
   - **Desktop / Web**: Call `flutterin_unpack_web_electron` (Runbook: [references/web-reconstruct.md](references/web-reconstruct.md)).
   - **API / Database**: Call `flutterin_inspect_har_sqlite` (Runbook: [references/traffic-database.md](references/traffic-database.md)).
   - **Native / AOT Binary**: Call `flutterin_analyze_binary` (Runbook: [references/binary-ffi.md](references/binary-ffi.md)).

### Phase 2: Structural Extraction & Model Synthesis
1. **Data Layer**:
   - Ingest JSON payloads, `.har` endpoints, or SQLite schemas into `flutterin_generate_models`.
   - Generates immutable `final class` DTOs with switch-expression `fromJson` mapping.
2. **Localization**:
   - Map extracted Android `strings.xml` or iOS `.lproj` tables into `lib/l10n/app_<locale>.arb` files using `flutter-setup-localization`.
   - `l10n.yaml` is auto-generated at project root (`arb-dir: lib/l10n`) during mobile decompilation.
   - `.arb` files are written to both `lib/core/l10n/` (legacy) and `lib/l10n/` (standard) for dual compatibility.
3. **Native Interop**:
   - If native C/C++/Rust shared libraries are extracted, configure `package:ffigen` via `dart-use-ffigen` and `dart-setup-ffi-assets`.
4. **Sovereign SharedPreferences Bridge**:
   - When `SharedPreferences` usage is detected in Android source, a type-safe `FlutterPrefsReader.kt` is auto-generated.
   - Binds to the sovereign channel `"FlutterSharedPreferences"` — eliminates the cold-start listener trap.
   - Includes Base64 prefix decoder (`VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGxpc3Qu`) and JSON array fallback.
   - Written to `native_bridges/android/FlutterPrefsReader.kt` AND `android/app/src/main/kotlin/<pkg>/` if project `android/` dir exists.
5. **Permission Gate Widget**:
   - When `BIND_ACCESSIBILITY_SERVICE` or `SYSTEM_ALERT_WINDOW` capabilities are detected, a `NativePermissionGateCard` Dart widget is auto-generated.
   - Kotlin handlers implement real `AccessibilityManager` checks and intent launchers (no mock APIs).
   - Dart widget written alongside the bridge file as `native_permission_gate_card.dart`.
6. **Enum AST Harvester**:
   - During JADX decompilation, `enum class` / `public enum` declarations are detected and extracted.
   - Generates clean Dart 3 enums from Kotlin/Java enum entries — prevents manual re-coding.
7. **Feature-First DNA Stratification**:
   - `stampDnaManifest()` maps `lib/features/*/domain/models` → `1_contracts`, `lib/features/*/domain` → `2_domain`, `lib/features/*/data` → `3_services`, `lib/core/bridge` → `3_services`, `lib/features/*/presentation/controllers` → `4_state`, `lib/features/*/presentation/screens` → `5_presentation`.
   - Backward-compatible with flat-layer aliases (`lib/contracts`, `lib/domain`, etc.).

### Phase 3: UI & Navigation Reconstruction
1. **4-Tier Conversion Cascade & Honest Feasibility Evaluation**:
   - Inspect the feasibility header (`[FLUTTERIN executionMode=...]`).
   - If `executionMode == "SEAMLESS_VIBE_CODING"`, proceed with automatic codegen across pure Flutter and ecosystem packages.
   - If `executionMode == "INTERACTIVE_ESCALATION_REQUIRED"`, STOP before writing unverified implementations for Tier 4 components. Ask the user to choose an implementation pathway.
2. **Screen Reconstruction**:
   - Run the appropriate converter (`flutterin_convert_android`, `flutterin_convert_ios`, or `flutterin_convert_web`).
   - Place screens in `lib/presentation/screens/` and state in `lib/state/`.
3. **Responsive Layouts**:
   - Wrap containers in `LayoutBuilder`, `Expanded`, and `Flexible`.
4. **Declarative Routing**:
   - Map manifest Activity/Fragment routes or React routes into `go_router`.

### Phase 4: Automated Verification & Audit
1. **Static Analysis & Formatting**:
   - If `flutter_dart-mcp-server` is available: invoke MCP tools `analyze_files`, `dart_fix`, and `dart_format`.
   - Standalone CLI Fallback: run `flutter analyze`, `dart fix --apply`, and `dart format .` via terminal.
2. **Layout Health**:
   - Run `flutter-fix-layout-issues` or verify constraints manually with `LayoutBuilder`.
3. **Accessibility Audit**:
   - If `flutter_a11y_agent` is available: invoke it to audit touch targets ($\ge 48\times 48\text{dp}$), WCAG color contrast, and Semantics nodes.
   - Standalone CLI Fallback: inspect widget tree for minimum 48dp sizes and descriptive `Semantics` labels.
4. **Hot Reload & Tests**:
   - Trigger `hot_reload` or run tests via `flutter test`.
