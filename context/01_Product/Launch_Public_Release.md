---
title: "General Availability (GA) Release Runbook"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# General Availability (GA) Release Runbook

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## GA Release Runbook
1. **Pre-Flight Audit**: Run `python .agents/scripts/orion.py verify_agents` and `npm test` across all platforms.
2. **NPM Publication**: Tag release `v1.0.0` on GitHub and publish package to npm registry.
3. **Binary Packaging**: Generate standalone single-executable binaries for macOS (ARM/x64), Linux (x64), and Windows (x64).
4. **Community Announcement**: Publish release blogs on Dev.to, Medium, Reddit r/FlutterDev, and Hacker News.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions
- (Add custom domain notes here)
