---
title: "Security Boundaries & Sandboxed Decompilation"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Security Boundaries & Sandboxed Decompilation

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Security & Sandboxing Model
- **Local Isolation**: All file operations, decompilations, and transpilations are executed locally; no customer code leaves the machine.
- **Safe Subprocess Spawning**: Command arguments are passed as explicit arrays to prevent shell injection vulnerabilities.
- **Safe Path Traversal**: Strict path sanitization to prevent directory traversal attacks during package unpacking.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
