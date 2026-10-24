---
title: "Frontend Transpilation Engine & Dart Emitter"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Frontend Transpilation Engine & Dart Emitter

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Transpilation Frontend Core (`src/parsers/`, `src/codegen/`)
- **Babel React Parser**: Parses JSX/TSX into unified AST; maps HTML elements (`div`, `span`, `p`, `img`, `button`, `input`) to Flutter primitives (`Container`, `Text`, `Image.network`, `FilledButton`, `TextField`).
- **Tailwind & CSS Resolver**: Translates utility classes (`flex`, `grid`, `p-4`, `m-2`, `bg-blue-500`, `rounded-xl`, `shadow-lg`) directly to `BoxDecoration`, `EdgeInsets`, and `BoxShadow`.
- **Constraint Validator**: Automatically injects `Expanded` or `Flexible` when unbounded children are placed inside `Row` or `Column` to prevent RenderFlex overflow errors.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. Android XML & Jetpack Compose Layout Transpilation
- **Android XML Parsing (`src/parsers/androidXmlParser.ts`)**:
  - `LinearLayout` (horizontal/vertical) $\to$ `Row` / `Column` with `MainAxisAlignment` and `CrossAxisAlignment`.
  - `RelativeLayout` & `ConstraintLayout` $\to$ `Stack` with `Positioned` or `Align` widgets, calculating proportional constraints.
  - `FrameLayout` $\to$ `Stack` or single-child `Container`.
  - `RecyclerView` / `ListView` $\to$ `ListView.builder` or `GridView.builder`.
  - Attribute translation: `android:layout_width="match_parent"` $\to$ `double.infinity`, `wrap_content` $\to$ unconstrained / intrinsic sizing.
- **Jetpack Compose AST Translation**:
  - Direct conversion of `@Composable` functions into Flutter `StatelessWidget` / `HookConsumerWidget`.
  - Maps `Modifier.padding()`, `Modifier.fillMaxSize()`, `Modifier.background()` to equivalent widget wrapper trees.

### 2. Flutter AOT Binary Reverse Engineering (`flutter-analysis.md`)
When reverse-engineering existing compiled Flutter applications:
- **Build Identification (`identify-flutter-build`)**:
  - Performs pure ELF header and section parsing on `libapp.so` without engine execution.
  - Locates the four primary snapshot dynamic symbols:
    - `_kDartVmSnapshotData`
    - `_kDartVmSnapshotInstructions`
    - `_kDartIsolateSnapshotData`
    - `_kDartIsolateSnapshotInstructions`
  - Extracts the **snapshot hash** from the snapshot header (prefixed by magic `0xf5f5dcdc`).
  - Matches snapshot hash against the Dart SDK release registry to identify the exact Dart SDK build.
- **AOT Symbol and Token Recovery (`inspect-dart-aot`)**:
  - Traverses dynamic symbol tables across ABIs (`arm64-v8a`, `armeabi-v7a`, `x86_64`).
  - Extracts string-pool tokens: package URIs (`package:*`), dart URIs (`dart:*`), and class-like tokens.
  - Generates reconstructed widget skeletons and service interface contracts based on recovered class tokens.

### 3. Layout Optimization & Overflow Prevention
- **Constraint Rectification**:
  - Enforces bounded viewport rules: wraps `Column` containing scrollable lists in `Expanded`.
  - Strips conflicting nested scroll controllers.
  - Validates flex factors to guarantee zero RenderFlex overflow on standard mobile resolutions (360dp - 430dp widths).
