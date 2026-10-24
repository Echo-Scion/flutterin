---
title: "System Architecture for Multi-Tenant Transpilation SaaS"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# System Architecture for Multi-Tenant Transpilation SaaS

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## Scaled Infrastructure Topology
- **CLI Core**: Ultra-fast standalone Node.js/TypeScript binary distributed via npm and Homebrew.
- **Local Isolation**: Zero code uploads required; AST decompilation runs entirely local on developer machine.
- **Optional Cloud Cloudburst**: Microservice cluster for deep AOT binary decompilation and LLM semantic enrichment.
- **Security Sandboxing**: Decompiled packages processed in ephemeral Docker containers with strict egress network policies.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
