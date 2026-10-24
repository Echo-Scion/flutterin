# Web & Electron Desktop Reconstruction

This reference guide details unpacking Electron desktop bundles and minified web assets, recovering original source components, and transpiling them into responsive Flutter 3 screens.

## Ecosystem Synergy & Hand-off Matrix

| Extraction Stage | `flutterin` Action | `.agents` Canon (or Standalone Built-in Fallback) | Official Flutter Plugin Skill / CLI Fallback |
| :--- | :--- | :--- | :--- |
| **Electron ASAR** | `flutterin unpack <app.asar>` (Pure TS unpacker) | Architecture mapping per `project-architect/SKILL.md` (or clean 5-Tier layout) | `flutter-apply-architecture-best-practices` (or standard `lib/` separation) |
| **Source Maps (.map)**| `flutterin unpack <bundle.js.map>` | Polyglot CST extraction via Pillar 2 (`ast-grep`) | `flutter-build-responsive-layout` (or `LayoutBuilder`) |
| **React / HTML Views**| `flutterin_convert_react` / `flutterin_convert_web` | `.agents/canons/ecosystems/flutter/flutter-ui-patterns.md` (or idiomatic Flutter Widgets) | `flutter-fix-layout-issues` (or check unbounded flex constraints) |
| **State Conversion** | Map Redux/Zustand $\rightarrow$ Riverpod 2.x | `.agents/canons/ecosystems/flutter/flutter-standards.md` (or UDF `AsyncNotifier`) | `dart-use-pattern-matching` (or switch expressions) |
| **Live Verification** | - | `.agents/rules/core-guardrails.md` (or zero-error static check) | `flutter_dart-mcp-server` (or CLI `flutter analyze && flutter test`) |

## Operational Runbook

1. **Unpack Bundles**:
   ```bash
   flutterin unpack path/to/app.asar -o ./unpacked_electron
   flutterin unpack path/to/bundle.js.map -o ./src_reconstructed
   ```
2. **Component Transpilation**:
   * Map React / Vue components with `flutterin_convert_react` or `flutterin_convert_web`.
   * Convert CSS Flexbox/Grid layouts into responsive Flutter `Row`, `Column`, `Wrap`, and `LayoutBuilder`.
3. **State & Store Migration**:
   * Map stores into Riverpod 2.x `AsyncNotifier` following `.agents/canons/ecosystems/flutter/flutter-standards.md`.
4. **Layout Verification**:
   * Eliminate unbounded constraints or RenderFlex overflows using official skill `flutter-fix-layout-issues`.
