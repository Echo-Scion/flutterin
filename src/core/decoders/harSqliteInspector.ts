/**
 * HAR Network Capture & SQLite Database Inspector
 * Parses HTTP Archive (.har) network traces into API contracts and inspects local SQLite databases into Dart models/schemas.
 */

import { DataModel, ModelField } from "../../ir/types.js";
import { runPythonScript } from "../bridges/pythonRunner.js";

export interface HarApiEndpoint {
  method: string;
  url: string;
  path: string;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  requestBodyJson?: unknown;
  responseStatus: number;
  responseBodyJson?: unknown;
  inferredModelName?: string;
}

export interface HarAnalysisResult {
  totalEntries: number;
  endpoints: HarApiEndpoint[];
  models: DataModel[];
}

export interface SqliteColumn {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  isPrimaryKey: boolean;
}

export interface SqliteTableSchema {
  tableName: string;
  sql: string;
  columns: SqliteColumn[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export interface SqliteInspectionResult {
  tables: SqliteTableSchema[];
  generatedDriftCode: string;
  generatedDartEntities: string;
}

export class HarSqliteInspector {
  public static parseHar(harContentOrJson: string | object): HarAnalysisResult {
    const har = typeof harContentOrJson === "string" ? JSON.parse(harContentOrJson) : harContentOrJson;
    const entries = har?.log?.entries || [];
    const endpoints: HarApiEndpoint[] = [];
    const models: DataModel[] = [];

    for (const entry of entries) {
      const req = entry.request;
      const res = entry.response;
      if (!req || !res) continue;

      const urlObj = new URL(req.url, "http://localhost");
      const pathName = urlObj.pathname;

      // Filter out static assets
      if (/\.(png|jpg|jpeg|gif|webp|svg|css|ico|woff|woff2|ttf)$/i.test(pathName)) {
        continue;
      }

      // Query params
      const queryParams: Record<string, string> = {};
      if (req.queryString && Array.isArray(req.queryString)) {
        for (const q of req.queryString) {
          queryParams[q.name] = q.value;
        }
      }

      // Headers (capture auth and content-type)
      const headers: Record<string, string> = {};
      if (req.headers && Array.isArray(req.headers)) {
        for (const h of req.headers) {
          const lower = h.name.toLowerCase();
          if (lower === "authorization" || lower === "content-type" || lower.startsWith("x-")) {
            headers[h.name] = h.value;
          }
        }
      }

      // Parse JSON response body if present
      let resJson: unknown;
      if (res.content?.mimeType?.includes("json") && res.content?.text) {
        try {
          resJson = JSON.parse(res.content.text);
        } catch {
          // ignore parsing error
        }
      }

      // Parse JSON request body if present
      let reqJson: unknown;
      if (req.postData?.mimeType?.includes("json") && req.postData?.text) {
        try {
          reqJson = JSON.parse(req.postData.text);
        } catch {
          // ignore
        }
      }

      // Generate model name from path (e.g. /api/v1/user-profiles -> UserProfile)
      const cleanSegments = pathName.split("/").filter((s) => s && !s.startsWith("v1") && !s.startsWith("v2") && !s.startsWith("api"));
      const lastSegment = cleanSegments[cleanSegments.length - 1] || "Response";
      const modelName = lastSegment
        .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
        .replace(/^[a-z]/, (c) => c.toUpperCase())
        .replace(/s$/, "");

      if (resJson && typeof resJson === "object") {
        const inferredModel = HarSqliteInspector.inferModelFromJson(modelName, resJson);
        if (inferredModel) {
          models.push(inferredModel);
        }
      }

      endpoints.push({
        method: req.method,
        url: req.url,
        path: pathName,
        queryParams,
        headers,
        requestBodyJson: reqJson,
        responseStatus: res.status,
        responseBodyJson: resJson,
        inferredModelName: modelName,
      });
    }

    return {
      totalEntries: entries.length,
      endpoints,
      models,
    };
  }

  public static async inspectSqlite(dbFilePath: string): Promise<SqliteInspectionResult> {
    const pythonScript = `
import sqlite3, json, sys, os, urllib.parse

path = os.path.abspath(sys.argv[1])
uri_path = urllib.parse.quote(path.replace('\\\\', '/'), safe='/:')
conn = sqlite3.connect(f'file:{uri_path}?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables_meta = cursor.fetchall()

    result = []
    for t in tables_meta:
        t_name = t['name']
        t_sql = t['sql'] or ''
        safe_name = t_name.replace('"', '""')
        cursor.execute(f'PRAGMA table_info("{safe_name}");')
        cols = []
        for c in cursor.fetchall():
            cols.append({
                'cid': c[0],
                'name': c[1],
                'type': c[2],
                'notNull': bool(c[3]),
                'defaultValue': str(c[4]) if c[4] is not None else None,
                'isPrimaryKey': bool(c[5])
            })
        cursor.execute(f'SELECT count(*) FROM "{safe_name}";')
        count = cursor.fetchone()[0]
        cursor.execute(f'SELECT * FROM "{safe_name}" LIMIT 3;')
        samples = []
        for row in cursor.fetchall():
            row_dict = {}
            for k in row.keys():
                v = row[k]
                if isinstance(v, bytes):
                    row_dict[k] = f"<BLOB {len(v)} bytes>"
                else:
                    row_dict[k] = v
            samples.append(row_dict)
        result.append({
            'tableName': t_name,
            'sql': t_sql,
            'columns': cols,
            'rowCount': count,
            'sampleRows': samples
        })
    print(json.dumps(result))
finally:
    conn.close()
`;

    try {
      const stdout = await runPythonScript(pythonScript, [dbFilePath]);
      const tables: SqliteTableSchema[] = JSON.parse(stdout);

      const driftCode = HarSqliteInspector.generateDriftSchemas(tables);
      const dartEntities = HarSqliteInspector.generateDartEntities(tables);

      return {
        tables,
        generatedDriftCode: driftCode,
        generatedDartEntities: dartEntities,
      };
    } catch (err: any) {
      throw new Error(`Failed to inspect SQLite database: ${err?.message || String(err)}`);
    }
  }

  private static inferModelFromJson(name: string, data: unknown): DataModel | null {
    const sample = Array.isArray(data) ? data[0] : data;
    if (!sample || typeof sample !== "object") return null;

    const fields: ModelField[] = [];
    for (const [key, val] of Object.entries(sample)) {
      let dartType = "dynamic";
      let isList = false;

      if (typeof val === "string") dartType = "String";
      else if (typeof val === "number") dartType = Number.isInteger(val) ? "int" : "double";
      else if (typeof val === "boolean") dartType = "bool";
      else if (Array.isArray(val)) {
        isList = true;
        dartType = val.length > 0 && typeof val[0] === "string" ? "String" : "dynamic";
      } else if (val !== null && typeof val === "object") {
        dartType = "Map<String, dynamic>";
      }

      const fieldName = HarSqliteInspector.sanitizeDartProp(key, fields.length);

      fields.push({
        name: fieldName,
        jsonKey: HarSqliteInspector.escapeDartLiteral(key),
        dartType,
        isNullable: val === null,
        isList,
      });
    }

    return { name, fields };
  }

  private static sanitizeDartProp(rawName: string, idx: number): string {
    const reserved = new Set([
      "abstract", "as", "assert", "async", "await", "base", "break", "case", "catch",
      "class", "const", "continue", "covariant", "default", "deferred", "do", "dynamic",
      "else", "enum", "export", "extends", "extension", "external", "factory", "false",
      "final", "finally", "for", "Function", "get", "hide", "if", "implements", "import",
      "in", "interface", "is", "late", "library", "mixin", "new", "null", "on", "operator",
      "part", "required", "rethrow", "return", "sealed", "set", "show", "static", "super",
      "switch", "sync", "this", "throw", "true", "try", "typedef", "var", "void", "when",
      "while", "with", "yield", "hashCode", "runtimeType", "toString",
    ]);
    const camel = rawName
      .replace(/[-_]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, "");
    const norm = camel ? camel.charAt(0).toLowerCase() + camel.slice(1) : `col${idx}`;
    const prefixed = /^[0-9]/.test(norm) ? `c${norm}` : norm;
    return reserved.has(prefixed) ? `${prefixed}Col` : prefixed;
  }

  private static sanitizeClassName(rawName: string): string {
    const clean = rawName
      .replace(/[^a-zA-Z0-9_]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9_]/g, "")
      .replace(/^[a-z]/, (c) => c.toUpperCase());
    return (!clean || /^[0-9]/.test(clean)) ? `T${clean || "Model"}` : clean;
  }

  private static escapeDartLiteral(val: string): string {
    return val.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$");
  }

  private static generateDriftSchemas(tables: SqliteTableSchema[]): string {
    let code = `import 'package:drift/drift.dart';\n\n`;

    for (const table of tables) {
      const className = HarSqliteInspector.sanitizeClassName(table.tableName);

      code += `class ${className}Table extends Table {\n`;
      table.columns.forEach((col, idx) => {
        let colMethod = "text()";
        const typeUpper = col.type.toUpperCase();

        if (typeUpper.includes("INT")) colMethod = "integer()";
        else if (typeUpper.includes("REAL") || typeUpper.includes("FLOAT") || typeUpper.includes("DOUB")) colMethod = "real()";
        else if (typeUpper.includes("BLOB")) colMethod = "blob()";
        else if (typeUpper.includes("BOOL")) colMethod = "boolean()";

        const safeColName = HarSqliteInspector.escapeDartLiteral(col.name);
        let chain = `${colMethod}.named('${safeColName}')`;
        if (col.isPrimaryKey) chain += "()";
        else if (col.notNull) chain += "()";
        else chain += ".nullable()()";

        const propName = HarSqliteInspector.sanitizeDartProp(col.name, idx);
        code += `  Column get ${propName} => ${chain};\n`;
      });
      code += `}\n\n`;
    }

    return code;
  }

  private static generateDartEntities(tables: SqliteTableSchema[]): string {
    const hasBlob = tables.some((t) => t.columns.some((c) => c.type.toUpperCase().includes("BLOB")));
    let code = hasBlob ? `import 'dart:typed_data';\n\n` : "";
    code += `// --- Auto-generated Dart Entities from SQLite ---\n\n`;

    for (const table of tables) {
      const className = HarSqliteInspector.sanitizeClassName(table.tableName);

      code += `final class ${className}Entity {\n`;
      table.columns.forEach((col, idx) => {
        let dType = "String";
        const typeUpper = col.type.toUpperCase();
        if (typeUpper.includes("INT")) dType = "int";
        else if (typeUpper.includes("REAL") || typeUpper.includes("FLOAT") || typeUpper.includes("DOUB")) dType = "double";
        else if (typeUpper.includes("BOOL")) dType = "bool";
        else if (typeUpper.includes("BLOB")) dType = "Uint8List";

        const propName = HarSqliteInspector.sanitizeDartProp(col.name, idx);
        const nullableSuffix = col.notNull ? "" : "?";
        code += `  final ${dType}${nullableSuffix} ${propName};\n`;
      });

      code += `\n  const ${className}Entity({\n`;
      table.columns.forEach((col, idx) => {
        const propName = HarSqliteInspector.sanitizeDartProp(col.name, idx);
        const requiredPrefix = col.notNull ? "required " : "";
        code += `    ${requiredPrefix}this.${propName},\n`;
      });
      code += `  });\n`;

      // fromRow mapping
      code += `\n  factory ${className}Entity.fromRow(Map<String, dynamic> row) => ${className}Entity(\n`;
      table.columns.forEach((col, idx) => {
        const propName = HarSqliteInspector.sanitizeDartProp(col.name, idx);
        const safeColName = HarSqliteInspector.escapeDartLiteral(col.name);
        code += `    ${propName}: row['${safeColName}'],\n`;
      });
      code += `  );\n`;

      code += `}\n\n`;
    }

    return code;
  }
}
