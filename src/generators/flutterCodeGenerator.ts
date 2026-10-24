import type { WidgetNode, DataModel, ModelField } from "../ir/types.js";
import { IdentitySanitizer } from "../core/identitySanitizer.js";
import { HybridNativeBridgeGenerator } from "./hybridNativeBridgeGenerator.js";

/**
 * Generates clean, idiomatic Flutter/Dart code from Intermediate Representation.
 */
export class FlutterCodeGenerator {
  private escapeDartString(val: string): string {
    return val
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\$/g, "\\$")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
  }

  private sanitizeIconName(rawIcon: string): string {
    const clean = rawIcon.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
    if (!clean || /^[0-9]/.test(clean)) return "star";
    return clean;
  }

  public collectTreeMetadata(node: WidgetNode): {
    requiresPlatformViewImports: boolean;
    recommendedPackages: string[];
    escalations: NonNullable<WidgetNode["escalation"]>[];
  } {
    let requiresPlatformViewImports = false;
    const pkgSet = new Set<string>();
    const escalations: NonNullable<WidgetNode["escalation"]>[] = [];

    const walk = (n: WidgetNode) => {
      if (
        n.type === "PlatformView" ||
        (n.rawSourceType && HybridNativeBridgeGenerator.isNativePlatformViewTag(n.rawSourceType))
      ) {
        requiresPlatformViewImports = true;
      }
      if (n.recommendedPackages) {
        for (const p of n.recommendedPackages) pkgSet.add(p);
      }
      if (n.escalation) {
        escalations.push(n.escalation);
      }
      for (const c of n.children) walk(c);
    };
    walk(node);

    return {
      requiresPlatformViewImports,
      recommendedPackages: Array.from(pkgSet),
      escalations,
    };
  }

  /**
   * Generates a complete StatelessWidget Dart file from a root WidgetNode.
   */
  public generateScreen(
    screenName: string,
    rootWidget: WidgetNode,
    options: { stateTarget?: "stateless" | "riverpod" } = {}
  ): string {
    const className = FlutterCodeGenerator.toPascalCase(screenName);
    const widgetBody = this.generateWidgetTree(rootWidget, 3);
    const isRiverpod = options.stateTarget === "riverpod";
    const safeScreenName = this.escapeDartString(screenName);
    const meta = this.collectTreeMetadata(rootWidget);

    const extraImports = meta.requiresPlatformViewImports
      ? `import 'package:flutter/foundation.dart';\nimport 'package:flutter/services.dart';\n`
      : "";
    const pkgBanner =
      meta.recommendedPackages.length > 0
        ? `// [TIER 2 ECOSYSTEM PLUGINS]: Recommended pubspec.yaml dependencies: ${meta.recommendedPackages.join(", ")}\n`
        : "";
    const escBanner =
      meta.escalations.length > 0
        ? meta.escalations
            .map(
              (e) =>
                `// [TIER 4 INTERACTIVE ESCALATION - USER CONFIRMATION REQUIRED]: ${e.sourceConstruct} (${e.reason})\n` +
                `//   Options: ${e.options.map((o) => `[${o.optionId}] ${o.label}`).join(" | ")}\n`
            )
            .join("")
        : "";

    if (isRiverpod) {
      return `${pkgBanner}${escBanner}import 'package:flutter/material.dart';
${extraImports}import 'package:flutter_riverpod/flutter_riverpod.dart';

class ${className} extends ConsumerWidget {
  const ${className}({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${safeScreenName}'),
      ),
      body: SafeArea(
        child: ${widgetBody},
      ),
    );
  }
}
`;
    }

    return `${pkgBanner}${escBanner}import 'package:flutter/material.dart';
${extraImports}
class ${className} extends StatelessWidget {
  const ${className}({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('${safeScreenName}'),
      ),
      body: SafeArea(
        child: ${widgetBody},
      ),
    );
  }
}
`;
  }

  /**
   * Generates a Dart Data Class with fromJson and toJson methods.
   */
  public generateDataModel(model: DataModel): string {
    const className = FlutterCodeGenerator.toPascalCase(model.name) || "DataModel";
    const subModelTypes = new Set(
      (model.subModels || []).map((sm) => FlutterCodeGenerator.toPascalCase(sm.name))
    );

    const fieldsDeclarations = model.fields
      .map((f) => `  final ${this.formatDartType(f)} ${f.name};`)
      .join("\n");

    const constructorParams = model.fields
      .map((f) => {
        const required = f.isNullable ? "" : "required ";
        return `    ${required}this.${f.name},`;
      })
      .join("\n");

    const fromJsonBody = model.fields
      .map((f) => {
        const jsonKey = f.jsonKey || f.name;
        const isNestedModel = subModelTypes.has(f.dartType);

        if (f.isList) {
          if (isNestedModel) {
            return `      ${f.name}: (json['${jsonKey}'] as List?)?.map((e) => ${f.dartType}.fromJson(Map<String, dynamic>.from(e as Map))).toList() ?? [],`;
          }
          return `      ${f.name}: (json['${jsonKey}'] as List?)?.map((e) => e as ${f.dartType}).toList() ?? [],`;
        }
        if (isNestedModel) {
          return f.isNullable
            ? `      ${f.name}: json['${jsonKey}'] != null ? ${f.dartType}.fromJson(Map<String, dynamic>.from(json['${jsonKey}'] as Map)) : null,`
            : `      ${f.name}: ${f.dartType}.fromJson(Map<String, dynamic>.from((json['${jsonKey}'] as Map?) ?? const {})),`;
        }
        if (f.dartType === "double") {
          return f.isNullable
            ? `      ${f.name}: (json['${jsonKey}'] as num?)?.toDouble(),`
            : `      ${f.name}: (json['${jsonKey}'] as num?)?.toDouble() ?? 0.0,`;
        }
        if (f.dartType === "Map<String, dynamic>") {
          return f.isNullable
            ? `      ${f.name}: json['${jsonKey}'] != null ? Map<String, dynamic>.from(json['${jsonKey}'] as Map) : null,`
            : `      ${f.name}: Map<String, dynamic>.from((json['${jsonKey}'] as Map?) ?? const {}),`;
        }
        if (f.isNullable) {
          return `      ${f.name}: json['${jsonKey}'] as ${f.dartType}?,`;
        }
        return `      ${f.name}: json['${jsonKey}'] as ${f.dartType},`;
      })
      .join("\n");

    const toJsonBody = model.fields
      .map((f) => {
        const jsonKey = f.jsonKey || f.name;
        const isNestedModel = subModelTypes.has(f.dartType);
        if (f.isList && isNestedModel) {
          return f.isNullable
            ? `      '${jsonKey}': ${f.name}?.map((e) => e.toJson()).toList(),`
            : `      '${jsonKey}': ${f.name}.map((e) => e.toJson()).toList(),`;
        }
        if (isNestedModel) {
          return f.isNullable
            ? `      '${jsonKey}': ${f.name}?.toJson(),`
            : `      '${jsonKey}': ${f.name}.toJson(),`;
        }
        return `      '${jsonKey}': ${f.name},`;
      })
      .join("\n");

    const mainClassCode = `class ${className} {
${fieldsDeclarations}

  const ${className}({
${constructorParams}
  });

  factory ${className}.fromJson(Map<String, dynamic> json) {
    return ${className}(
${fromJsonBody}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonBody}
    };
  }
}
`;

    if (model.subModels && model.subModels.length > 0) {
      const subCode = model.subModels.map((sm) => this.generateDataModel(sm)).join("\n");
      return `${mainClassCode}\n${subCode}`;
    }

    return mainClassCode;
  }

  /**
   * Recursively generates Flutter widget tree expressions.
   */
  public generateWidgetTree(node: WidgetNode, indentLevel: number): string {
    if (
      node.type === "PlatformView" ||
      (node.type !== "CustomPaint" && node.rawSourceType && HybridNativeBridgeGenerator.isNativePlatformViewTag(node.rawSourceType))
    ) {
      const defaultIdentity = IdentitySanitizer.resolveIdentity();
      return HybridNativeBridgeGenerator.generatePlatformViewWidgetExpr(
        node.rawSourceType || "PlatformView",
        defaultIdentity,
        indentLevel
      );
    }

    if (node.properties.isExpanded || (typeof node.properties.flex === "number" && node.properties.flex > 0)) {
      const indent = "  ".repeat(indentLevel);
      const childIndent = "  ".repeat(indentLevel + 1);
      const flexProp = typeof node.properties.flex === "number" && node.properties.flex > 1
        ? `\n${childIndent}flex: ${node.properties.flex},`
        : "";
      const innerNode: WidgetNode = {
        ...node,
        properties: { ...node.properties, isExpanded: false, flex: undefined },
      };
      const innerCode = this.generateWidgetTree(innerNode, indentLevel + 1);
      return `Expanded(${flexProp}\n${childIndent}child: ${innerCode},\n${indent})`;
    }

    const indent = "  ".repeat(indentLevel);
    const childIndent = "  ".repeat(indentLevel + 1);

    switch (node.type) {
      case "Column":
      case "Row": {
        const children = node.children
          .map((child) => {
            const needsAutoExpand =
              (child.type === "ListView" || child.type === "GridView") &&
              !child.properties.isExpanded &&
              !child.properties.height &&
              !child.properties.width;
            const effectiveChild = needsAutoExpand
              ? { ...child, properties: { ...child.properties, isExpanded: true } }
              : child;
            return `${childIndent}${this.generateWidgetTree(effectiveChild, indentLevel + 1)},`;
          })
          .join("\n");

        const mainAlign = node.properties.alignment
          ? `\n${childIndent}mainAxisAlignment: MainAxisAlignment.${node.properties.alignment},`
          : "";
        const crossAlign = node.properties.crossAlignment
          ? `\n${childIndent}crossAxisAlignment: CrossAxisAlignment.${node.properties.crossAlignment},`
          : "";

        const baseWidget = `${node.type}(${mainAlign}${crossAlign}
${childIndent}children: [
${children}
${childIndent}],
${indent})`;

        const padding = this.generateEdgeInsets(node.properties.padding);
        const margin = this.generateEdgeInsets(node.properties.margin);
        const hasBoxContainerProps = Boolean(
          node.properties.backgroundColor ||
          node.properties.borderRadius ||
          margin ||
          node.properties.width ||
          node.properties.height
        );

        if (hasBoxContainerProps) {
          let containerProps = "";
          if (node.properties.width === "infinity") {
            containerProps += `\n${childIndent}width: double.infinity,`;
          } else if (typeof node.properties.width === "number") {
            containerProps += `\n${childIndent}width: ${node.properties.width},`;
          }
          if (node.properties.height === "infinity") {
            containerProps += `\n${childIndent}height: double.infinity,`;
          } else if (typeof node.properties.height === "number") {
            containerProps += `\n${childIndent}height: ${node.properties.height},`;
          }
          if (padding) containerProps += `\n${childIndent}padding: ${padding},`;
          if (margin) containerProps += `\n${childIndent}margin: ${margin},`;
          if (node.properties.backgroundColor || node.properties.borderRadius) {
            const color = node.properties.backgroundColor
              ? `\n${childIndent}  color: Color(${this.formatColorHex(node.properties.backgroundColor)}),`
              : "";
            const radius = node.properties.borderRadius
              ? `\n${childIndent}  borderRadius: BorderRadius.circular(${node.properties.borderRadius}),`
              : "";
            containerProps += `\n${childIndent}decoration: BoxDecoration(${color}${radius}\n${childIndent}),`;
          }
          return `Container(${containerProps}\n${childIndent}child: ${baseWidget},\n${indent})`;
        }

        if (padding) {
          return `Padding(
${childIndent}padding: ${padding},
${childIndent}child: ${baseWidget},
${indent})`;
        }
        return baseWidget;
      }

      case "Stack": {
        const children = node.children
          .map((child) => `${childIndent}${this.generateWidgetTree(child, indentLevel + 1)},`)
          .join("\n");

        const baseWidget = `Stack(
${childIndent}children: [
${children}
${childIndent}],
${indent})`;

        const padding = this.generateEdgeInsets(node.properties.padding);
        if (padding) {
          return `Padding(
${childIndent}padding: ${padding},
${childIndent}child: ${baseWidget},
${indent})`;
        }
        return baseWidget;
      }

      case "ListView": {
        const children = node.children
          .map((child) => `${childIndent}${this.generateWidgetTree(child, indentLevel + 1)},`)
          .join("\n");

        return `ListView(
${childIndent}children: [
${children}
${childIndent}],
${indent})`;
      }

      case "GridView": {
        const children = node.children
          .map((child) => `${childIndent}${this.generateWidgetTree(child, indentLevel + 1)},`)
          .join("\n");

        return `GridView.count(
${childIndent}crossAxisCount: 2,
${childIndent}children: [
${children}
${childIndent}],
${indent})`;
      }

      case "Padding": {
        const child = node.children[0]
          ? this.generateWidgetTree(node.children[0], indentLevel + 1)
          : "const SizedBox.shrink()";
        const padding = this.generateEdgeInsets(node.properties.padding) || "const EdgeInsets.all(8)";

        return `Padding(
${childIndent}padding: ${padding},
${childIndent}child: ${child},
${indent})`;
      }

      case "SingleChildScrollView": {
        const child = node.children[0]
          ? this.generateWidgetTree(node.children[0], indentLevel + 1)
          : "const SizedBox.shrink()";

        return `SingleChildScrollView(
${childIndent}child: ${child},
${indent})`;
      }

      case "Text": {
        const text = this.escapeDartString(String(node.properties.text ?? ""));
        const style = this.generateTextStyle(node.properties, indentLevel + 1);
        if (style) {
          return `const Text(\n${childIndent}'${text}',\n${childIndent}style: ${style},\n${indent})`;
        }
        return `const Text('${text}')`;
      }

      case "ElevatedButton":
      case "TextButton":
      case "OutlinedButton": {
        let buttonChild: string;
        if (node.children.length === 1) {
          buttonChild = this.generateWidgetTree(node.children[0], indentLevel + 1);
        } else if (node.children.length > 1) {
          const grandChildIndent = "  ".repeat(indentLevel + 2);
          const renderedChildren = node.children
            .map((c) => `${grandChildIndent}${this.generateWidgetTree(c, indentLevel + 2)},`)
            .join("\n");
          buttonChild = `Row(\n${grandChildIndent}mainAxisSize: MainAxisSize.min,\n${grandChildIndent}children: [\n${renderedChildren}\n${grandChildIndent}],\n${childIndent})`;
        } else {
          const label = this.escapeDartString(String(node.properties.text ?? "Button"));
          buttonChild = `const Text('${label}')`;
        }
        return `${node.type}(
${childIndent}onPressed: () {},
${childIndent}child: ${buttonChild},
${indent})`;
      }

      case "IconButton": {
        const iconName = this.sanitizeIconName(String(node.properties.iconName ?? "star"));
        return `IconButton(
${childIndent}onPressed: () {},
${childIndent}icon: const Icon(Icons.${iconName}),
${indent})`;
      }

      case "Card": {
        let childExpr: string;
        if (node.children.length === 0) {
          childExpr = "const SizedBox.shrink()";
        } else if (node.children.length === 1) {
          childExpr = this.generateWidgetTree(node.children[0], indentLevel + 1);
        } else {
          const grandChildIndent = "  ".repeat(indentLevel + 2);
          const childrenList = node.children
            .map((c) => `${grandChildIndent}${this.generateWidgetTree(c, indentLevel + 2)},`)
            .join("\n");
          childExpr = `Column(\n${grandChildIndent}mainAxisSize: MainAxisSize.min,\n${grandChildIndent}crossAxisAlignment: CrossAxisAlignment.start,\n${grandChildIndent}children: [\n${childrenList}\n${grandChildIndent}],\n${childIndent})`;
        }

        return `Card(
${childIndent}child: ${childExpr},
${indent})`;
      }

      case "Switch": {
        return `StatefulBuilder(
${childIndent}builder: (context, setState) {
${childIndent}  bool isSwitched = false;
${childIndent}  return Switch(
${childIndent}    value: isSwitched,
${childIndent}    onChanged: (val) => setState(() => isSwitched = val),
${childIndent}  );
${childIndent}},
${indent})`;
      }

      case "Checkbox": {
        return `StatefulBuilder(
${childIndent}builder: (context, setState) {
${childIndent}  bool isChecked = false;
${childIndent}  return Checkbox(
${childIndent}    value: isChecked,
${childIndent}    onChanged: (val) => setState(() => isChecked = val ?? false),
${childIndent}  );
${childIndent}},
${indent})`;
      }

      case "Spacer": {
        return `const Spacer()`;
      }

      case "TextField": {
        const hint = this.escapeDartString(String(node.properties.hintText ?? ""));
        return `const TextField(
${childIndent}decoration: InputDecoration(
${childIndent}  hintText: '${hint}',
${childIndent}  border: OutlineInputBorder(),
${childIndent}),
${indent})`;
      }

      case "Image": {
        const src = this.escapeDartString(String(node.properties.src ?? "assets/placeholder.png"));
        return `Image.asset(
${childIndent}'${src}',
${childIndent}fit: BoxFit.cover,
${indent})`;
      }

      case "Icon": {
        const iconName = this.sanitizeIconName(String(node.properties.iconName ?? "star"));
        return `const Icon(Icons.${iconName})`;
      }

      case "Container": {
        const child = node.children[0]
          ? `\n${childIndent}child: ${this.generateWidgetTree(node.children[0], indentLevel + 1)},`
          : "";

        let props = "";
        if (node.properties.width === "infinity") {
          props += `\n${childIndent}width: double.infinity,`;
        } else if (typeof node.properties.width === "number") {
          props += `\n${childIndent}width: ${node.properties.width},`;
        }

        if (node.properties.height === "infinity") {
          props += `\n${childIndent}height: double.infinity,`;
        } else if (typeof node.properties.height === "number") {
          props += `\n${childIndent}height: ${node.properties.height},`;
        }

        const padding = this.generateEdgeInsets(node.properties.padding);
        if (padding) props += `\n${childIndent}padding: ${padding},`;

        const margin = this.generateEdgeInsets(node.properties.margin);
        if (margin) props += `\n${childIndent}margin: ${margin},`;

        if (node.properties.backgroundColor || node.properties.borderRadius) {
          const color = node.properties.backgroundColor
            ? `\n${childIndent}  color: Color(${this.formatColorHex(node.properties.backgroundColor)}),`
            : "";
          const radius = node.properties.borderRadius
            ? `\n${childIndent}  borderRadius: BorderRadius.circular(${node.properties.borderRadius}),`
            : "";
          props += `\n${childIndent}decoration: BoxDecoration(${color}${radius}\n${childIndent}),`;
        }

        return `Container(${props}${child}\n${indent})`;
      }

      case "Slider": {
        return `StatefulBuilder(
${childIndent}builder: (context, setState) {
${childIndent}  double sliderValue = 0.5;
${childIndent}  return Slider(
${childIndent}    value: sliderValue,
${childIndent}    onChanged: (val) => setState(() => sliderValue = val),
${childIndent}  );
${childIndent}},
${indent})`;
      }

      case "FloatingActionButton": {
        return `FloatingActionButton(
${childIndent}onPressed: () {},
${childIndent}child: const Icon(Icons.add),
${indent})`;
      }

      case "CustomPaint": {
        // Tier 4 stays visibly unresolved instead of a silent Placeholder.
        const label = String(node.rawSourceType || node.type).replace(/[^A-Za-z0-9_.]/g, "");
        const marker = node.escalation ? "TIER4_AWAITING_DECISION" : "UNIMPLEMENTED_CUSTOM_PAINT";
        return `/* ${marker}:${label} */ const Placeholder(fallbackHeight: 120)`;
      }

      case "CircularProgressIndicator":
        return `const CircularProgressIndicator()`;

      case "LinearProgressIndicator":
        return `const LinearProgressIndicator()`;

      case "Divider":
        return `const Divider()`;

      case "SizedBox": {
        const w = node.properties.width ? `width: ${node.properties.width}, ` : "";
        const h = node.properties.height ? `height: ${node.properties.height}, ` : "";
        return `const SizedBox(${w}${h})`;
      }

      default: {
        if (node.rawSourceType && HybridNativeBridgeGenerator.isNativePlatformViewTag(node.rawSourceType)) {
          const defaultIdentity = IdentitySanitizer.resolveIdentity();
          return HybridNativeBridgeGenerator.generatePlatformViewWidgetExpr(
            node.rawSourceType,
            defaultIdentity,
            indentLevel
          );
        }
        const unmappedLabel = String(node.rawSourceType || node.type).replace(/[^A-Za-z0-9_.]/g, "");
        return `/* UNMAPPED:${unmappedLabel} */ const Placeholder()`;
      }
    }
  }

  private formatColorHex(rawColor: string): string {
    const hex = rawColor.replace("#", "");
    if (hex.length === 8) return `0x${hex}`;
    if (hex.length === 6) return `0xFF${hex}`;
    if (hex.length === 3) {
      const expanded = hex.split("").map(c => c + c).join("");
      return `0xFF${expanded}`;
    }
    return `0xFF${hex.padStart(6, "0").slice(0, 6)}`;
  }

  private generateEdgeInsets(
    insets?: { top?: number; bottom?: number; left?: number; right?: number }
  ): string | null {
    if (!insets) return null;
    const { top = 0, bottom = 0, left = 0, right = 0 } = insets;
    if (top === bottom && left === right && top === left && top > 0) {
      return `const EdgeInsets.all(${top})`;
    }
    if (top === bottom && left === right && (top > 0 || left > 0)) {
      return `const EdgeInsets.symmetric(horizontal: ${left}, vertical: ${top})`;
    }
    if (top > 0 || bottom > 0 || left > 0 || right > 0) {
      return `const EdgeInsets.only(top: ${top}, bottom: ${bottom}, left: ${left}, right: ${right})`;
    }
    return null;
  }

  private generateTextStyle(props: WidgetNode["properties"], indentLevel: number): string | null {
    const items: string[] = [];
    if (props.fontSize) items.push(`fontSize: ${props.fontSize}`);
    if (props.fontWeight) items.push(`fontWeight: FontWeight.${props.fontWeight}`);
    if (props.textColor) {
      items.push(`color: Color(${this.formatColorHex(props.textColor)})`);
    }

    if (items.length === 0) return null;
    return `TextStyle(${items.join(", ")})`;
  }

  private formatDartType(f: ModelField): string {
    const baseType = f.isList ? `List<${f.dartType}>` : f.dartType;
    return f.isNullable ? `${baseType}?` : baseType;
  }

  public static toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
  }

  public static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z]+)(?=[A-Z][a-z])|([a-z0-9])(?=[A-Z])/g, "$&_")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .replace(/^_+|_+$/g, "");
  }
}
