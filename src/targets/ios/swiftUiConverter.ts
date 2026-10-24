import type { WidgetNode, WidgetPropertyMap, WidgetType } from "../../ir/types.js";
import { customBuildEscalation, ecosystemPluginMeta, withTierMeta } from "../../ir/escalation.js";

const TIER2_SWIFTUI_VIEWS: Record<string, string[]> = {
  Map: ["google_maps_flutter", "flutter_map"],
  VideoPlayer: ["video_player", "media_kit"],
  WKWebView: ["webview_flutter", "flutter_inappwebview"],
  WebView: ["webview_flutter", "flutter_inappwebview"],
};

const TIER4_SWIFTUI_VIEWS: Record<string, string> = {
  Canvas: "SwiftUI Canvas uses imperative immediate-mode drawing.",
  SceneView: "SceneKit 3D scene rendering has no Flutter equivalent.",
  RealityView: "RealityKit / ARKit rendering has no Flutter equivalent.",
  ARView: "ARKit camera and scene rendering has no Flutter equivalent.",
  MTKView: "Metal rendering pipeline requires a shader and render-loop port.",
  MetalView: "Metal rendering pipeline requires a shader and render-loop port.",
};

/**
 * Converts iOS SwiftUI View declarations into Flutterin WidgetNode IR.
 */
export class SwiftUiConverter {
  /**
   * Parses SwiftUI code into a WidgetNode tree.
   */
  public parseSwiftUi(code: string): WidgetNode {
    // Safely remove comments without truncating http(s):// URLs
    const cleaned = code
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => {
        const commentIdx = line.indexOf("//");
        if (commentIdx !== -1) {
          const before = line.slice(0, commentIdx);
          if (!before.includes('"') || (before.match(/"/g) || []).length % 2 === 0) {
            return before;
          }
        }
        return line;
      })
      .join("\n")
      .trim();

    // Strip struct ... : View { var body: some View { ... } } wrapper if present
    const structBodyMatch = cleaned.match(/struct\s+[a-zA-Z0-9_]+\s*:\s*View\s*\{[\s\S]*?var\s+body\s*:\s*some\s+View\s*\{([\s\S]*)\}\s*\}$/);
    const codeToParse = structBodyMatch ? structBodyMatch[1].trim() : cleaned;

    return this.parseView(codeToParse);
  }

  private parseView(code: string): WidgetNode {
    const trimmed = code.trim();
    const head = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)/)?.[1] ?? "";

    // Tier 2: native-only views with a mature pub.dev package
    if (TIER2_SWIFTUI_VIEWS[head]) {
      return withTierMeta(
        { type: "PlatformView", rawSourceType: head, properties: {}, children: [] },
        ecosystemPluginMeta(TIER2_SWIFTUI_VIEWS[head])
      );
    }

    // Tier 4: custom rendering that needs a user decision before any 0-to-1 build
    if (TIER4_SWIFTUI_VIEWS[head]) {
      return withTierMeta(
        { type: "CustomPaint", rawSourceType: head, properties: {}, children: [] },
        customBuildEscalation("ios", head, TIER4_SWIFTUI_VIEWS[head], {
          label: `Embed original '${head}' via UiKitView PlatformView`,
          description: "Register a platform view factory in Swift AppDelegate and mount it with UiKitView.",
        })
      );
    }

    // Tier 1 leaf controls
    if (head === "Toggle") {
      return { type: "Switch", rawSourceType: "Toggle", properties: {}, children: [] };
    }
    if (head === "Slider") {
      return { type: "Slider", rawSourceType: "Slider", properties: {}, children: [] };
    }
    if (head === "ProgressView") {
      return { type: "CircularProgressIndicator", rawSourceType: "ProgressView", properties: {}, children: [] };
    }

    // Check Stack containers: VStack, HStack, ZStack, List, ScrollView and navigation/grid wrappers
    const stackMatch = trimmed.match(/^(VStack|HStack|ZStack|LazyVStack|LazyHStack|List|ScrollView|NavigationStack|NavigationView|Form|Section|LazyVGrid|LazyHGrid)(\s*\((?:[^()]|\([^()]*\))*\))?\s*\{([\s\S]*)\}([\s\S]*)$/);

    if (stackMatch) {
      const containerType = stackMatch[1];
      const body = stackMatch[3];
      const modifiers = stackMatch[4] || "";

      let widgetType: WidgetType = "Column";
      if (containerType === "VStack" || containerType === "LazyVStack") widgetType = "Column";
      else if (containerType === "HStack" || containerType === "LazyHStack") widgetType = "Row";
      else if (containerType === "ZStack") widgetType = "Stack";
      else if (containerType === "List" || containerType === "Form") widgetType = "ListView";
      else if (containerType === "ScrollView") widgetType = "SingleChildScrollView";
      else if (containerType === "LazyVGrid" || containerType === "LazyHGrid") widgetType = "GridView";
      else if (containerType === "NavigationStack" || containerType === "NavigationView" || containerType === "Section") widgetType = "Column";

      const properties: WidgetPropertyMap = {};
      this.applyModifiers(modifiers, properties);

      const children = this.extractBlockChildren(body).map((child) => this.parseView(child));

      return {
        type: widgetType,
        rawSourceType: containerType,
        properties,
        children,
      };
    }

    // Check Text("...")
    const textMatch = trimmed.match(/^Text\(\s*"([^"]*)"\s*\)([\s\S]*)$/);
    if (textMatch) {
      const text = textMatch[1];
      const modifiers = textMatch[2] || "";
      const properties: WidgetPropertyMap = { text };
      this.applyModifiers(modifiers, properties);

      return {
        type: "Text",
        rawSourceType: "Text",
        properties,
        children: [],
      };
    }

    // Check Button("...")
    const buttonMatch = trimmed.match(/^Button\(\s*"([^"]*)"\s*[\s\S]*\)([\s\S]*)$/);
    if (buttonMatch) {
      const text = buttonMatch[1];
      const modifiers = buttonMatch[2] || "";
      const properties: WidgetPropertyMap = { text };
      this.applyModifiers(modifiers, properties);

      return {
        type: "ElevatedButton",
        rawSourceType: "Button",
        properties,
        children: [],
      };
    }

    // Check TextField("...")
    const textFieldMatch = trimmed.match(/^TextField\(\s*"([^"]*)"\s*,[\s\S]*\)([\s\S]*)$/);
    if (textFieldMatch) {
      const hint = textFieldMatch[1];
      const modifiers = textFieldMatch[2] || "";
      const properties: WidgetPropertyMap = { hintText: hint };
      this.applyModifiers(modifiers, properties);

      return {
        type: "TextField",
        rawSourceType: "TextField",
        properties,
        children: [],
      };
    }

    // Check Image("...") or Image(systemName: "...")
    const imageMatch = trimmed.match(/^Image\(\s*(?:systemName:\s*)?"([^"]*)"\s*\)([\s\S]*)$/);
    if (imageMatch) {
      const name = imageMatch[1];
      const isSystem = trimmed.includes("systemName:");
      return {
        type: isSystem ? "Icon" : "Image",
        rawSourceType: "Image",
        properties: isSystem ? { iconName: name } : { src: name },
        children: [],
      };
    }

    // Check Spacer()
    if (trimmed.startsWith("Spacer()")) {
      return {
        type: "Spacer",
        properties: {},
        children: [],
      };
    }

    // Unmapped view: keep the source name so the generator labels it instead of hiding it
    return {
      type: "Container",
      rawSourceType: head || undefined,
      properties: {},
      children: [],
    };
  }

  private applyModifiers(modifiers: string, props: WidgetPropertyMap) {
    if (!modifiers) return;

    const modMatches = modifiers.matchAll(/\.([a-zA-Z0-9_]+)\(([^)]*)\)/g);
    for (const m of modMatches) {
      const modName = m[1];
      const modArg = m[2];

      if (modName === "padding") {
        const val = modArg ? parseInt(modArg, 10) || 16 : 16;
        props.padding = { top: val, bottom: val, left: val, right: val };
      } else if (modName === "bold") {
        props.fontWeight = "bold";
      } else if (modName === "fontWeight" && modArg.includes("bold")) {
        props.fontWeight = "bold";
      } else if (modName === "font") {
        if (modArg.includes("largeTitle")) props.fontSize = 34;
        else if (modArg.includes("title2")) props.fontSize = 22;
        else if (modArg.includes("title")) props.fontSize = 28;
        else if (modArg.includes("headline")) {
          props.fontSize = 17;
          props.fontWeight = "bold";
        } else if (modArg.includes("subheadline")) props.fontSize = 15;
        else if (modArg.includes("caption")) props.fontSize = 12;
      } else if (modName === "cornerRadius") {
        const val = parseInt(modArg, 10);
        if (!isNaN(val)) props.borderRadius = val;
      }
    }
  }

  private extractBlockChildren(body: string): string[] {
    const lines = body.split("\n");
    const results: string[] = [];
    let currentChunk = "";
    let depth = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;

      if (trimmed.startsWith(".") && results.length > 0 && depth === 0 && !currentChunk) {
        results[results.length - 1] += " " + trimmed;
        continue;
      }

      currentChunk += (currentChunk ? " " : "") + trimmed;

      for (const char of trimmed) {
        if (char === "{") depth++;
        if (char === "}") depth--;
      }

      const nextLine = lines.slice(i + 1).find((l) => l.trim().length > 0)?.trim();
      const hasUpcomingModifier = nextLine && nextLine.startsWith(".");

      if (depth === 0 && !hasUpcomingModifier) {
        results.push(currentChunk);
        currentChunk = "";
      }
    }

    if (currentChunk.trim()) {
      results.push(currentChunk.trim());
    }

    return results;
  }
}
