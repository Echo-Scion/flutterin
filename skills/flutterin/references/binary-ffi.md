# Native Binary & Flutter AOT Inspection

This reference guide details analyzing native shared libraries or compiled Flutter AOT snapshots and generating type-safe Dart FFI bindings.

## Ecosystem Synergy & Hand-off Matrix

| Extraction Stage | `flutterin` Action | `.agents` Canon (or Standalone Built-in Fallback) | Official Flutter Plugin Skill / CLI Fallback |
| :--- | :--- | :--- | :--- |
| **Flutter AOT (`libapp.so`)**| `flutterin binary <libapp.so>` | SQLite 677+ Engine catalog matching | Inspect with `flutter_dart-mcp-server` runtime tools |
| **Native Shared Objects**| `flutterin binary <lib.so / .dll>` | Architecture review via `project-architect/SKILL.md` (or clean FFI contract) | `dart-use-ffigen` (`ffigen.yaml`) |
| **Native Code Assets** | Exported C symbol discovery | Pillar 1/6 native binary reader | `dart-setup-ffi-assets` (`hook/build.dart`) |
| **Disassembly Bridges** | Headless Rizin (`rz-bin`) / WABT (`wasm2wat`) | `.agents/rules/four-pillars-architecture.md` (or CLI disassembly) | Transpile pure algorithmic routines into Dart 3 |

## Operational Runbook

1. **AOT & Binary Inspection**:
   ```bash
   flutterin binary path/to/libapp.so
   flutterin binary path/to/native_module.dll
   ```
2. **Dart FFI Generation**:
   * Inspect extracted exported symbols and headers.
   * Auto-generated `NativeLibraryBindings` class opens the library and binds native function pointers (`lookupFunction`).
   * Configure `ffigen.yaml` and hook scripts following official skills `dart-use-ffigen` and `dart-setup-ffi-assets`.
