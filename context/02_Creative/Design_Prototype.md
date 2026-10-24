---
title: "Interactive Prototypes & Terminal Mockups"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Interactive Prototypes & Terminal Mockups

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## CLI Interaction Prototype
```text
$ flutterin mobile myapp.apk
[i] Scanning package: myapp.apk (Size: 24.2 MB)
[+] Extracted AndroidManifest.xml (Package: com.example.myapp, Version: 2.1.0)
[+] Found 8 Activities, 14 Layout XMLs, 1 SQLite Database, 12 Network Endpoints
[>] Transpiling UI to Flutter Material 3...
    [OK] MainActivity -> lib/screens/main_screen.dart
    [OK] ProfileActivity -> lib/screens/profile_screen.dart
[>] Generating Drift Database schema...
    [OK] app_database.sqlite -> lib/data/database.dart
[>] Generating Dio API clients...
    [OK] 12 endpoints -> lib/services/api_service.dart
[SUCCESS] Generated 24 Dart source files in ./flutter_project/ (Time: 1.42s)
```
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
