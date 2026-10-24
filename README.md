<div align="center">

# 🐦 flutterin

### Reverse Engineering into Flutter & Dart Codebases

<p align="center">
  <b>AI agent tool as layout & asset transpiler for Flutter & Dart.</b>
</p>

[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](package.json)
[![Flutter Ready](https://img.shields.io/badge/Flutter-Ready-02569B?logo=flutter&logoColor=white)](https://flutter.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Tests](https://img.shields.io/badge/tests-65%20passed-brightgreen.svg)](src/tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> ⚠️ **Warning**: Being tested only on personal workflows; this project is currently in active development and has not yet been used to build any production project.
>
> 🛑 **Notice**: 100% AI-generated slop, side project for personal use. AI-audited with Gemini 4 Argon. Sources are unknown; if rights are offended, please remind me. Openly reverse engineering others' work harms original creators—giving credits does not compensate for someone's livelihood and hard work. Use responsibly, ethically, and privately.

<p align="center">
  <a href="#-lineage--ecosystem-autonomy"><b>Lineage</b></a> •
  <a href="#-quickstart--operational-profiles"><b>Quickstart</b></a> •
  <a href="#-core-architecture--the-6-reversing-pillars"><b>6 Reversing Pillars</b></a> •
  <a href="#-4-tier-conversion-cascade--honest-escalation"><b>4-Tier Cascade</b></a> •
  <a href="#-cli-reference"><b>CLI Reference</b></a> •
  <a href="#-mcp-tools-15-registered"><b>15 MCP Tools</b></a>
</p>

</div>

---

<a id="-lineage--ecosystem-autonomy"></a>
## 🏛️ Lineage & Ecosystem Autonomy

`flutterin` is a direct lineage and fork of [REA (Reverse Engineer Anything)](https://github.com/morluto/rea.git), purpose-built to reverse engineer multi-platform assets directly into Flutter & Dart codebases. It operates with full architectural autonomy:
* **Lineage & Fork**: Built upon the reverse-engineering methodology and binary ingestion foundations of [morluto/rea](https://github.com/morluto/rea.git).
* **Native Tooling & SDK**: Leverages host Flutter SDK, Dart SDK, and the [Official Dart & Flutter Plugin](https://docs.flutter.dev/ai/get-started) (`flutter_dart-mcp-server`) for mechanical verification, static analysis, formatting, and unit testing.
* **Ecosystem Autonomy**: Deep bidirectional synergy with [Portable Brainvibing (`.agents`)](https://github.com/Echo-Scion/portable-brainvibing) for living Project DNA and cognitive memory, while maintaining 100% standalone execution capability for any AI coding agent.

---

<a id="-core-architecture--the-6-reversing-pillars"></a>
## 🏛️ Core Architecture & The 6 Reversing Pillars

`flutterin` runs on **Node.js 18+ (ESM)** and **Python 3.10+**. Over 85% of capabilities run with **zero external binary installations** using pure TypeScript/Python parsers, falling back gracefully to deep provider tools only when needed.

| Pillar | Focus | Built-in Zero-Install Decoders | Deep Provider Tools |
| :--- | :--- | :--- | :--- |
| **1. Floor & AOT** | Python 3.10+, SQLite3 | Pure TS AXML parser, Binary Plist reader, SQLite schema inspector, 677+ Flutter Engine snapshot catalog | - |
| **2. CLI Proxy** | Terminal efficiency | Cargo Rust `rtk` (Rust Token Killer) proxy for 60%–90% noise token reduction | - |
| **3. Web & Cross-UI** | Declarative layouts | Android XML (`LinearLayout`, `ConstraintLayout` solver with `@dimen`/`@string` symbol tables), HTML + Tailwind CSS, React Native JSX, and SwiftUI View converters into Flutter IR | - |
| **4. App Decoders** | Asset recovery | Chromium Pickle ASAR unpacker, v3 SourceMap reconstructor, HAR 1.2 REST payload parser, `.arb` localization generator | - |
| **5. Mobile** | Android & iOS packages | ZIP extraction, `AndroidManifest.xml` & `res/layout/*.xml` decoding, DEX scanner, `IdentitySanitizer` package scrubbing | JDK 17, `jadx`, `apktool`, `adb` live screen dumps |
| **6. Native & FFI** | Binary analysis | ELF (`.so`), PE (`.dll`/`.exe`), Mach-O, and WASM binary readers; automated `dart:ffi` bindings & `package:ffigen` YAML generator | Rizin (`rz-bin`), WABT (`wasm2wat`), Frida SSL bypass generator |

---

<a id="-4-tier-conversion-cascade--honest-escalation"></a>
## ⚖️ 4-Tier Conversion Cascade & Honest Escalation

Converting arbitrary platforms into Flutter has physical limits. `flutterin` avoids silent mock placeholders or empty `Container()` fallbacks by enforcing a deterministic 4-Tier Conversion Cascade:

```
                       [ Input: Screen / Target / Artifact ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
         [ Standard Primitives ]                         [ Heavy / Platform Native ]
                 │                                               │
     ┌───────────┴───────────┐                       ┌───────────┴───────────┐
     ▼                       ▼                       ▼                       ▼
  [ TIER 1 ]              [ TIER 2 ]              [ TIER 3 ]              [ TIER 4 ]
Pure Flutter         Ecosystem Plugin         Hybrid Native Bridge     Custom Build / Escalation
(Row, Text, etc.)    (webview_flutter,        (MethodChannel,          (Direct3D, Metal, Wasm,
                     video_player, etc.)      Kotlin / Swift Host)     Heavy Canvas, 3D Mesh)
     │                       │                       │                       │
     └───────────┬───────────┘                       └───────────┬───────────┘
                 │                                               │
                 ▼                                               ▼
    ⚡ SEAMLESS VIBE-CODING                           🛑 INTERACTIVE ESCALATION GATE
  (Zero friction, full auto-codegen)               (Stops, explains tradeoffs, asks user)
```

1. **Tier 1 (Pure Flutter)**: UI primitives (`Column`, `Row`, `Stack`, `Text`, `Button`, `Image`, `TextField`, `Slider`, `LinearProgressIndicator`, `Divider`) compile to pure Flutter & Dart.
2. **Tier 2 (Ecosystem Plugin)**: Standard platform views (`WKWebView` $\to$ `webview_flutter`, `VideoPlayer` $\to$ `video_player`, `Map` $\to$ `google_maps_flutter`) map to verified pub.dev packages.
3. **Tier 3 (Hybrid Native Bridge)**: OS-level capabilities (accessibility services, system overlays, `SharedPreferences` bindings) generate `MethodChannel` Dart services with Kotlin/Swift host bridge scaffolds and permission cards (`PermissionGateCard`).
4. **Tier 4 (Custom Build / Escalation)**: Platform-bound engines (Metal shaders, WebGL, custom Canvas rasterizers) cannot be automatically converted. Execution halts, places a visible `CustomPaint` placeholder, and prompts the operator to choose an implementation path.

---

<a id="-quickstart--operational-profiles"></a>
## 🚀 Quickstart for AI Coding Agents

If you are operating standalone without [Portable Brainvibing (`.agents`)](https://github.com/Echo-Scion/portable-brainvibing), follow these 3 steps from your terminal or let your AI coding agent (Antigravity CLI, Claude Code, Cursor, Codex CLI) execute them:

### Step 1: Verify Host Prerequisites & Clone Repository
`flutterin` relies on your local Flutter and Dart SDKs for code verification and compilation. Ensure your environment has:
- **Node.js (v18+)**
- **Python 3.10+** (with standard library SQLite3)
- **Flutter SDK** and **Dart SDK** (providing `flutter`, `dart`, `dart format`, and `flutter analyze`)

Open your terminal or PowerShell and run:

```bash
# 1. Clone flutterin repository
git clone https://github.com/Echo-Scion/flutterin.git
cd flutterin

# 2. Install dependencies and compile project
npm install
npm run build

# 3. Link the 'flutterin' command globally to your shell PATH
npm link
```

### Step 2: Verify Toolchain Health & Run Setup (`doctor` & `setup`)
Run `flutterin setup` and `flutterin doctor` to audit your SDK toolchains and MCP integrations:

```bash
# 1. Run automated profile check (verifies Node, Python, Flutter SDK, Dart SDK)
flutterin setup web-ui

# 2. Comprehensive 6-Pillar health audit
flutterin doctor
```
> 💡 **Graceful Fallback & Official Dart Plugin**:
> - **In AI Agent Environments (Gemini / Claude / Cursor)**: When the official [Flutter & Dart MCP plugin](https://docs.flutter.dev/ai/get-started) is present (`flutter_dart-mcp-server`), agents automatically invoke official tools (`dart_fix`, `dart_format`, `analyze_files`) on generated code.
> - **In Standalone Shells**: If the MCP plugin is absent, `flutterin` falls back gracefully to your local host SDK commands (`dart format`, `flutter analyze`, and `flutter test`).
> - **For UI Transpilation**: You can immediately convert HTML, React JSX, Android XML, and JSON APIs without installing third-party decompiler tools (*100% Zero-Install built-in decoders*).

### Step 3: Run Your First Code Conversion
`flutterin` performs deterministic AST parsing off-thread to generate baseline Flutter code instantly. The AI agent (or developer) executes the command, and the agent then handles architectural refinement, state management, and tests:

```bash
# Example A: Convert an Android XML layout into a Flutter Widget
flutterin android res/layout/activity_login.xml -s LoginScreen -o lib/screens/login.dart

# Example B: Convert Web HTML + Tailwind CSS into a responsive Flutter Widget
flutterin web landing.html -s LandingScreen -o lib/screens/landing.dart

# Example C: Convert a JSON API response into an immutable Dart model & Dio client
flutterin api user_response.json -m User -o lib/models/user.dart
```

---

## 🎯 Operational Profiles & Dependency Matrix

`flutterin setup` inspects your host toolchains and prints exact one-liner commands (via `winget`, `brew`, or `apt`) for any missing dependencies:

| Profile | Target Capabilities | Core & SDK Dependencies | Decompilation Tools | Setup Command |
| :--- | :--- | :--- | :--- | :--- |
| **`web-ui`** *(Default)* | React JSX, Tailwind HTML, SwiftUI, Android XML, JSON API, SQLite | Node.js, Python, Flutter SDK, Dart SDK | **None** (100% Zero-Install built-in) | `flutterin setup web-ui` |
| **`mobile`** | Deep Android APK/AAB decompilation and live ADB screen dumps | Node.js, Python, Flutter SDK, Dart SDK | JDK 17, JADX, ADB, Apktool | `flutterin setup mobile` |
| **`native`** | AOT `libapp.so` catalog matching, C/C++ `.so`/`.dll` binary analysis | Node.js, Python, Flutter SDK, Dart SDK | Rizin disassembler, WABT | `flutterin setup native` |
| **`full`** | Complete 6-Pillar reverse-engineering laboratory | Node.js, Python, Flutter SDK, Dart SDK | All tools + RTK CLI proxy | `flutterin setup full` |

Check requirements or inspect a specific profile at any time:
```bash
# Inspect all profiles
flutterin setup --list

# Verify and get missing package installation commands for mobile
flutterin setup mobile

# Health check scoped to web-ui profile
flutterin doctor -p web-ui
```

---

## 🔌 3 Deployment Modes for AI Coding Agents

`flutterin` exposes 15 specialized reverse-engineering tools callable by AI coding assistants across three operational configurations:

### Mode 1: Agent CLI Tool (Codex CLI, Antigravity CLI, Claude Code)
AI agents invoke `flutterin` directly via subshell execution to transpile layouts or decompile packages without consuming prompt tokens on raw XML/ASAR:
```bash
# Agent inspects environment and toolchain
flutterin doctor -p web-ui

# Agent transpiles an Android layout to a clean Dart widget
flutterin android res/layout/activity_login.xml -s LoginScreen -o lib/screens/login.dart
```

### Mode 2: Model Context Protocol (MCP) Server (Claude Code, Cursor, Windsurf, VS Code)
Add `flutterin` to your agent's MCP configuration (`~/.gemini/config/mcp_config.json` or `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "flutterin": {
      "command": "node",
      "args": ["<FULL_PATH_TO_FLUTTERIN>/dist/mcp/index.js"]
    }
  }
}
```
All 15 tools become natively discoverable and callable by your LLM assistant via JSON-RPC.

### Mode 3: Antigravity Plugin & Co-Deployment with Portable-Brainvibing
- **Antigravity Plugin**: Link as an Antigravity plugin (`~/.gemini/config/plugins/flutterin`) to enable all 15 MCP tools and the `@flutterin_agent` persona.
- **Portable-Brainvibing Synergy**: When inside a workspace managed by `.agents`, running `python .agents/scripts/orion.py foundation deploy` auto-detects `../flutterin`, auto-links the MCP bridge, tracks living Project DNA (`.agents/.dna.json`), and enables epistemic SaaS matrix synthesis (`flutterin context`).

---

<a id="-cli-reference"></a>
## 💻 CLI Reference

```bash
# --- Health & Toolchain Diagnostics ---
flutterin doctor                                        # Audit 6-pillar toolchain & plugin status
flutterin setup mobile                                  # Show exact install commands for missing tools

# --- Mobile Package & ADB Inspection ---
flutterin mobile app.apk -o lib/decompiled_app          # Decompile APK/AAB/DEX/IPA into Flutter UI & .arb
flutterin adb --list                                    # List connected Android devices
flutterin adb --dump -o lib/screens/cloned_screen.dart  # Dump active device screen into Flutter widget
flutterin adb --pull com.example.app -o ./apks          # Pull installed APK from device

# --- Web, Electron & Network Inspection ---
flutterin unpack app.asar -o ./unpacked_electron        # Unpack Electron bundle
flutterin unpack bundle.js.map -o ./src_reconstructed   # Recover original TS/React components
flutterin inspect traffic.har                           # HAR -> Immutable Dart DTOs & Dio API client
flutterin inspect database.db                           # SQLite -> Type-safe Drift schema & DAOs

# --- Binary & AOT Reversing ---
flutterin binary libapp.so                              # Match AOT snapshot hash against 677+ releases
flutterin binary native_module.dll                      # Native exports -> dart:ffi stubs & dynamic loader

# --- Single-Target UI Converters ---
flutterin android layout.xml -s LoginScreen -o lib/screens/login.dart
flutterin web landing.html -s LandingScreen -o lib/screens/landing.dart
flutterin react Component.jsx -s ProfileScreen -o lib/screens/profile.dart
flutterin ios View.swift -s HomeScreen -o lib/screens/home.dart
flutterin api payload.json -m User -u https://api.com/users -o lib/models/user.dart

# --- Epistemic Context Synthesis (In .agents Workspaces) ---
flutterin context .scratch/reverse/app/raw -o ./context   # Selective signal-driven context
flutterin context .scratch/reverse/app/raw -o ./context -a # Scaffold all 82 matrix slots
```

---

<a id="-mcp-tools-15-registered"></a>
## 🛠️ MCP Tools (15 Registered)

| Tool | Capability |
| :--- | :--- |
| `flutterin_doctor` | Check 6-Pillar health, decompiler availability, and plugin status |
| `flutterin_decompile_mobile_package` | Ingest `.apk`/`.aab`/`.dex`/`.ipa` $\to$ Flutter widgets, `.arb` strings, and models |
| `flutterin_adb_inspect_live` | ADB device commands: list devices, dump active UI hierarchy, pull APK |
| `flutterin_unpack_web_electron` | Unpack `.asar` archives or reconstruct original TSX/Vue from `.js.map` |
| `flutterin_inspect_har_sqlite` | Ingest `.har` network traces or `.sqlite` tables into Dart contracts and Drift schemas |
| `flutterin_analyze_binary` | Analyze Flutter AOT snapshot headers or ELF/PE/Mach-O/WASM binaries $\to$ `dart:ffi` |
| `flutterin_generate_context` | Scan source/decompiled assets $\to$ populate 82-file context matrix with epistemic tags |
| `flutterin_reverse_flutter_to_context` | Reverse-engineer Flutter app (APK/IPA/libapp.so) into full 82-file context matrix |
| `flutterin_convert_android` | Convert Android XML (text/AXML) and ConstraintLayouts to Flutter widgets |
| `flutterin_convert_web` | Convert HTML + Tailwind CSS to responsive Flutter widgets |
| `flutterin_convert_react` | Convert React / React Native JSX to Flutter widgets |
| `flutterin_convert_ios` | Convert iOS SwiftUI Views to Flutter widgets |
| `flutterin_generate_models` | Generate Dart immutable models with pattern matching and Dio clients |
| `flutterin_list_engines` | Query SQLite 677+ Flutter Engine catalog by snapshot hash or commit ID |
| `flutterin_generate_interceptor` | Generate Frida runtime SSL unpinning scripts for HTTPS capture |

---

## 🧠 Reverse Engineering Staging Protocol

1. **Staging Directory Isolation**: Never dump raw decompilation outputs into `lib/` or git history.
   - In `.agents` workspaces: stage in `.scratch/reverse/<target_name>/` (ignored by git and scanner).
   - In standalone workspaces: stage in `./build_reverse/<target_name>/`.
2. **5-Phase Flutter Porting Order**:
   - **Phase 1: Contracts & Models (`lib/contracts/`)**: Drift schemas and immutable Dart DTOs from SQLite and JSON.
   - **Phase 2: Services & API Layer (`lib/services/`)**: Dio HTTP clients from HAR network traces.
   - **Phase 3: Design Tokens & Theme (`lib/theme/`)**: Material 3 `ThemeData` from `colors.xml`, `styles.xml`, or Tailwind variables.
   - **Phase 4: Presentation & Screens (`lib/presentation/`)**: Widget trees via layout converters with resolved `@dimen`/`@string` symbols.
   - **Phase 5: Router & App State (`lib/state/`)**: Declarative `GoRouter` navigation from manifest intent filters.
3. **Non-Destructive Bounded Anchors**: Generated matrix files use bounded anchors (`<!-- [ORION:AUTO-INFERRED:START] -->` ... `<!-- [ORION:AUTO-INFERRED:END] -->`), ensuring developer modifications outside anchors remain 100% intact across re-scans.

---





---

## 👥 Contributors

* [@Echo-Scion](https://github.com/Echo-Scion) — Core maintainer & architecture
* **Google Gemini** (AI Pair Programmer) — Architecture drafting, test generation & refactoring

---

## 📄 License

Distributed under the [MIT License](LICENSE).
