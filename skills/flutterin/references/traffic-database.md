# Network Traffic & Database Reverse Engineering

This reference guide details inspecting captured HTTP/HTTPS traffic and embedded SQLite databases, synthesizing immutable Dart 3 DTOs and Drift schemas.

## Ecosystem Synergy & Hand-off Matrix

| Extraction Stage | `flutterin` Action | `.agents` Canon (or Standalone Built-in Fallback) | Official Flutter Plugin Skill / CLI Fallback |
| :--- | :--- | :--- | :--- |
| **HAR Payloads** | `flutterin inspect <traffic.har>` | Schema validation per `project-architect/SKILL.md` (or clean DTO contracts) | `flutter-implement-json-serialization` (or `fromJson`/`toJson`) |
| **Dart 3 Models** | `flutterin_generate_models` | Immutable models per `data-logic/SKILL.md` (or `final class` DTOs) | `dart-use-pattern-matching` & `dart-use-primary-constructors` (or modern Dart 3) |
| **Network Clients** | Scaffold typed Dio / `http` client | `.agents/canons/ecosystems/flutter/flutter-standards.md` (or typed repository client) | `flutter-use-http-package` (or Dio service class) |
| **SQLite Schemas** | `flutterin inspect <database.db>` | Drift DDL & DAO generation | Local persistent store for Flutter repositories |
| **SSL Interception** | `flutterin interceptor -p <pkg>` | Frida diagnostic script | Runtime dynamic traffic capture without root certs |

## Operational Runbook

1. **Traffic Analysis**:
   ```bash
   flutterin inspect path/to/traffic.har
   ```
2. **Model Generation**:
   * Generate null-safe Dart 3 immutable classes with switch-expression `fromJson` mapping.
3. **Database Schema Extraction**:
   ```bash
   flutterin inspect path/to/database.db
   ```
   * Extract table structures into type-safe Drift tables and Dart entity classes.
