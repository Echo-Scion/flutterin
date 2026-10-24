---
title: "Authentication & Session Security Extraction"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Authentication & Session Security Extraction

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Auth Reverse Engineering
- Identifies authentication headers (`Bearer`, `Authorization`, `X-API-Key`) in network traces.
- Generates secure token storage patterns using `flutter_secure_storage` and Keychain/Keystore wrappers.
- Emits OAuth2 refresh token interceptors in Dart.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
