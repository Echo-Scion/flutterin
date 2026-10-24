# Mobile Application Decompilation & Reconstruction

This reference guide details decompilation of compiled Android and iOS applications directly into production-grade Flutter 3 / Dart 3 codebases.

## Ecosystem Synergy & Hand-off Matrix

| Extraction Stage | `flutterin` Action | `.agents` Canon (or Standalone Built-in Fallback) | Official Flutter Plugin Skill / CLI Fallback |
| :--- | :--- | :--- | :--- |
| **Package & Manifest** | `flutterin mobile <pkg> -o <out>` (Pure AXML / Plist parser) | Extract package ID & permissions | `flutter-setup-declarative-routing` (or CLI `go_router`) |
| **Layouts & Screens** | `flutterin_convert_android` / `flutterin_convert_ios` | `.agents/canons/ecosystems/flutter/flutter-standards.md` (or Built-in UDF 5-state rule) | `flutter-apply-architecture-best-practices` & `flutter-build-responsive-layout` (or `LayoutBuilder`) |
| **Localization** | Scans `res/values-*/strings.xml` $\rightarrow$ `lib/l10n/app_<locale>.arb` | `.agents/rules/prose-authenticity.md` (or clean `.arb` locale tables) | `flutter-setup-localization` (or CLI `l10n.yaml`) |
| **Live Screen Clone** | `flutterin adb --dump` | `.agents/canons/ecosystems/flutter/flutter-ui-patterns.md` (or standard Widget tree) | `flutter_a11y_agent` (or manual 48dp touch target audit) |
| **Verification Gate** | - | `.agents/rules/core-guardrails.md` (or zero-error static check) | `flutter_dart-mcp-server` (or CLI `flutter analyze && flutter test`) |

## Operational Runbook

1. **Package Ingestion**:
   ```bash
   flutterin mobile path/to/app.apk -o lib/decompiled_app
   ```
   * Built-in AXML and Plist decoders run with zero external CLI dependencies.
   * If JADX or Apktool is installed, deep bytecode and resource table decompilation runs automatically.

2. **Screen Reconstruction**:
   * Inspect decoded XML layouts under `res/layout/`.
   * Convert layouts into idiomatic Flutter widgets with `flutterin_convert_android` or `flutterin_convert_ios`.
   * Ensure reconstructed widgets adhere to the official layered approach (`ui/<feature>/widgets/` and `ui/<feature>/view_models/`).

3. **Multi-Locale Strings**:
   * Extracted locale tables are saved as `lib/l10n/app_<locale>.arb`.
   * Configure `l10n.yaml` per the official skill `flutter-setup-localization`.

4. **Live Device Cloning via ADB**:
   ```bash
   flutterin adb --dump -o lib/screens/cloned_screen.dart
   ```
   * Instantly converts the active runtime screen hierarchy from a connected device into a responsive Flutter screen.
   * Pass through `flutter_a11y_agent` to audit accessibility.

5. **Architecture Detection — Feature-First vs. Layer-First**:
   * After decompilation, `stampDnaManifest()` auto-detects which structure the output fits.
   * Feature-First detected when decompiled source has feature sub-directories under `lib/features/`.
   * Canonical aliases are written for both patterns — agents can query either `lib/features/auth/domain` or `lib/domain` and get correct DNA strata.
   * Override with `--arch=feature-first` or `--arch=layer-first` at CLI invocation.

6. **Gradle Hygiene Sanitizer**:
   * After identity sanitization, `sanitizeAndroidGradleAndRes()` prunes dead AndroidX Navigation deps:
     - Removed: `navigation-fragment-ktx`, `navigation-ui-ktx`, `safeargs`, `constraintlayout`, `gson`, `viewBinding = true`.
   * Orphan `Doki.*` styles are pruned from `res/values/styles.xml` unless `keptCapabilities` includes `"doki"`.
   * Root `README.md` is synchronized with target identity from `BLUEPRINT.md`.
   * Run in dry-run mode first: `sanitizeAndroidGradleAndRes(workspaceDir, { dryRun: true })`.

7. **Enum AST Harvester**:
   * Triggered automatically during `harvestJadxSources()` when JADX is available.
   * Detects `enum class` (Kotlin) and `public enum` (Java) declarations in decompiled `.kt`/`.java` files.
   * Extracts enum entries and generates clean Dart 3 `enum` declarations — placed in `lib/features/<feature>/domain/models/` or `lib/contracts/` depending on detected architecture.
   * Prevents manual re-coding of business-critical enum state machines (e.g., `BallState`, `GamePhase`).
