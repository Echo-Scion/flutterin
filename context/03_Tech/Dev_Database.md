---
title: "Database Schemas & Drift ORM Codegen"
epistemic_status: AST_VERIFIED
source_artifacts: ["src/parsers/", "src/codegen/", "src/cli/"]
needs_human_review: false
last_scanned: 2026-10-20T14:23:18.671647+00:00
---

# Database Schemas & Drift ORM Codegen

<!-- [FLUTTERIN:AUTO-INFERRED:START source="flutterin-engine" confidence="AST_VERIFIED"] -->
## SQLite Schema Extractor (`src/core/decoders/harSqliteInspector.ts`)
- Reads raw SQLite database files (`.db`, `.sqlite`, `.sqlite3`).
- Extracts tables, column types (`INTEGER`, `TEXT`, `REAL`, `BLOB`), primary keys, and foreign key relations.
- Emits idiomatic Drift ORM Dart classes (`@DataClassName`, `Table`, `IntColumn`, `TextColumn`) with type-safe query builders.
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->
## Manual Architecture & Business Decisions

### 1. SQLite Snapshot Inspection (`sqlite-databases.md`)
- **Inspection Mechanics (`inspect-sqlite-database`)**:
  - Leverages Node.js native `DatabaseSync` API without external binary dependencies.
  - Snapshot isolation: opens local copies in read-only mode to prevent file-locking conflicts with active host apps.
  - Three schema scopes:
    - `inventory`: Compact metadata of tables, indices, views, and trigger names.
    - `selected_table`: Expands detailed column definitions, default constraints, nullability, and primary key facets for one table.
    - `database`: Complete recursive introspection of all database tables.
  - Safe row sampling: bounded sampling (`--row-limit 20`) with strict projection of visible columns to protect memory usage.
  - Virtual & shadow tables: identifies FTS3/4/5 and R-Tree tables, tagging backing tables appropriately.

### 2. Drift ORM Dart Code Generation
- **Type Mapping Specification**:
  - SQLite `INTEGER` $\to$ Dart `IntColumn` (`int`)
  - SQLite `TEXT` / `VARCHAR` $\to$ Dart `TextColumn` (`String`)
  - SQLite `REAL` / `FLOAT` / `DOUBLE` $\to$ Dart `RealColumn` (`double`)
  - SQLite `BLOB` $\to$ Dart `BlobColumn` (`Uint8List`)
  - Nullability: columns without `NOT NULL` are emitted with `.nullable()`.
  - Primary keys & auto-increment: mapped directly to `.autoIncrement()`.
- **Entity & DAO Architecture**:
  - Emits `@DataClassName("EntityName")` annotations for clean domain modeling.
  - Synthesizes Repository classes with CRUD query methods (`select`, `insert`, `update`, `delete`) and reactive streams (`watch`).

### 3. Network Storage & Packet Decoding (`http3-capture-lab.md`, `pcap-analysis.md`)
- **Network Archive Ingestion**:
  - Parses HTTP Archive (`.har`) and PCAP packet captures to reconstruct REST and GraphQL API schemas.
  - Infers response schemas across multiple sample calls, synthesizing union types and optional fields.
  - Emits Dio client classes with automatic interceptor setup for authorization headers and retry logic.
