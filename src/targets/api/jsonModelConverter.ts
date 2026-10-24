import type { DataModel, ModelField } from "../../ir/types.js";

/**
 * Converts API JSON payloads (e.g. from network logs, HAR, or endpoints)
 * into strongly-typed recursive Dart data models and resilient Dio client code.
 */
export class JsonModelConverter {
  private static toPascalCase(str: string): string {
    const pascal = str
      .replace(/[^a-zA-Z0-9]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
    return /^[0-9]/.test(pascal) ? `M${pascal}` : pascal;
  }

  private static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z]+)(?=[A-Z][a-z])|([a-z0-9])(?=[A-Z])/g, "$&_")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .replace(/^_+|_+$/g, "");
  }

  private static readonly DART_RESERVED_WORDS = new Set([
    "abstract", "as", "assert", "async", "await", "base", "break", "case", "catch",
    "class", "const", "continue", "covariant", "default", "deferred", "do", "dynamic",
    "else", "enum", "export", "extends", "extension", "external", "factory", "false",
    "final", "finally", "for", "Function", "get", "hide", "if", "implements", "import",
    "in", "interface", "is", "late", "library", "mixin", "new", "null", "on", "operator",
    "part", "required", "rethrow", "return", "sealed", "set", "show", "static", "super",
    "switch", "sync", "this", "throw", "true", "try", "typedef", "var", "void", "when",
    "while", "with", "yield",
  ]);

  private static sanitizeIdentifier(rawKey: string, index: number): string {
    const camel = rawKey
      .replace(/[^a-zA-Z0-9_]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase())
      .replace(/[^a-zA-Z0-9_]/g, "");
    const normalized = camel ? camel.charAt(0).toLowerCase() + camel.slice(1) : `field${index}`;
    const prefixed = /^[0-9]/.test(normalized) ? `f${normalized}` : normalized;
    return JsonModelConverter.DART_RESERVED_WORDS.has(prefixed) ? `${prefixed}Value` : prefixed;
  }

  private static escapeDartString(val: string): string {
    return val
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\$/g, "\\$")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  /**
   * Infers DataModel definition (and nested sub-models recursively) from a sample JSON object.
   */
  public parseJson(modelName: string, jsonInput: string | Record<string, unknown>): DataModel {
    const cleanInput = typeof jsonInput === "string" ? jsonInput.replace(/^\uFEFF/, "").trim() : jsonInput;
    const data = typeof cleanInput === "string" ? JSON.parse(cleanInput) : cleanInput;
    const sample = Array.isArray(data) ? data[0] : data;

    if (typeof sample !== "object" || sample === null || Array.isArray(sample)) {
      throw new Error("JSON input must be an object or an array of objects.");
    }

    const subModels: DataModel[] = [];
    const seenSubModelNames = new Set<string>();
    const rootClassName = JsonModelConverter.toPascalCase(modelName || "AutoModel");

    const buildModelRecursive = (currentName: string, obj: Record<string, unknown>): DataModel => {
      const usedFieldNames = new Set<string>();
      const fields: ModelField[] = Object.entries(obj).map(([key, value], idx) => {
        let dartType = "dynamic";
        let isList = false;

        if (typeof value === "string") {
          dartType = "String";
        } else if (typeof value === "number") {
          dartType = Number.isInteger(value) ? "int" : "double";
        } else if (typeof value === "boolean") {
          dartType = "bool";
        } else if (Array.isArray(value)) {
          isList = true;
          if (value.length > 0) {
            const item = value[0];
            if (typeof item === "string") dartType = "String";
            else if (typeof item === "number") dartType = Number.isInteger(item) ? "int" : "double";
            else if (typeof item === "boolean") dartType = "bool";
            else if (item !== null && typeof item === "object" && !Array.isArray(item)) {
              const singularKey = key.replace(/ies$/i, "y").replace(/s$/i, "") || "Item";
              const nestedClassName = JsonModelConverter.toPascalCase(`${currentName}_${singularKey}`);
              if (!seenSubModelNames.has(nestedClassName) && Object.keys(item).length > 0) {
                seenSubModelNames.add(nestedClassName);
                subModels.push(buildModelRecursive(nestedClassName, item as Record<string, unknown>));
              }
              dartType = Object.keys(item).length > 0 ? nestedClassName : "Map<String, dynamic>";
            } else {
              dartType = "dynamic";
            }
          }
        } else if (value !== null && typeof value === "object") {
          const objRecord = value as Record<string, unknown>;
          if (Object.keys(objRecord).length > 0) {
            const nestedClassName = JsonModelConverter.toPascalCase(`${currentName}_${key}`);
            if (!seenSubModelNames.has(nestedClassName)) {
              seenSubModelNames.add(nestedClassName);
              subModels.push(buildModelRecursive(nestedClassName, objRecord));
            }
            dartType = nestedClassName;
          } else {
            dartType = "Map<String, dynamic>";
          }
        }

        let safeName = JsonModelConverter.sanitizeIdentifier(key, idx);
        while (usedFieldNames.has(safeName)) {
          safeName = `${safeName}_${idx}`;
        }
        usedFieldNames.add(safeName);

        return {
          name: safeName,
          jsonKey: JsonModelConverter.escapeDartString(key),
          dartType,
          isNullable: value === null,
          isList,
        };
      });

      return {
        name: currentName,
        fields,
      };
    };

    const rootModel = buildModelRecursive(rootClassName, sample as Record<string, unknown>);
    rootModel.name = modelName || "AutoModel";
    if (subModels.length > 0) {
      rootModel.subModels = subModels;
    }
    return rootModel;
  }

  /**
   * Generates a complete Dio API service client in Dart that safely handles both List and single-object payloads.
   */
  public generateDioService(modelName: string, endpointUrl: string): string {
    const className = JsonModelConverter.toPascalCase(modelName) || "ItemModel";
    const serviceName = `${className}Service`;
    const fileName = JsonModelConverter.toSnakeCase(modelName) || "item_model";
    const normalizedUrl = endpointUrl.replace(/\/+$/, "");
    const safeUrl = JsonModelConverter.escapeDartString(normalizedUrl);

    return `import 'package:dio/dio.dart';
import '../models/${fileName}.dart';

class ${serviceName} {
  final Dio _dio;

  ${serviceName}({Dio? dio}) : _dio = dio ?? Dio();

  Future<List<${className}>> fetchAll() async {
    final response = await _dio.get('${safeUrl}');
    if (response.statusCode == 200) {
      final raw = response.data;
      if (raw is List) {
        return raw.map((json) => ${className}.fromJson(Map<String, dynamic>.from(json as Map))).toList();
      } else if (raw is Map<String, dynamic>) {
        final listCandidate = raw['data'] ?? raw['items'] ?? raw['results'];
        if (listCandidate is List) {
          return listCandidate.map((json) => ${className}.fromJson(Map<String, dynamic>.from(json as Map))).toList();
        }
        return [${className}.fromJson(raw)];
      }
      return const [];
    } else {
      throw Exception('Failed to load ${className} from ${safeUrl}');
    }
  }

  Future<${className}> fetchById(String id) async {
    final response = await _dio.get('${safeUrl}/\$id');
    if (response.statusCode == 200) {
      return ${className}.fromJson(Map<String, dynamic>.from(response.data as Map));
    } else {
      throw Exception('Failed to load ${className} with id \$id');
    }
  }
}
`;
  }
}
