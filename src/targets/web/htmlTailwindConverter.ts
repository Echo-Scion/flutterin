import { XMLParser } from "fast-xml-parser";
import type { WidgetNode, WidgetPropertyMap, WidgetType } from "../../ir/types.js";
import { customBuildEscalation, ecosystemPluginMeta, withTierMeta } from "../../ir/escalation.js";

const TIER2_HTML_TAGS: Record<string, { type: WidgetType; packages: string[] }> = {
  iframe: { type: "PlatformView", packages: ["webview_flutter", "flutter_inappwebview"] },
  embed: { type: "PlatformView", packages: ["webview_flutter", "flutter_inappwebview"] },
  object: { type: "PlatformView", packages: ["webview_flutter", "flutter_inappwebview"] },
  video: { type: "PlatformView", packages: ["video_player", "media_kit"] },
  audio: { type: "PlatformView", packages: ["just_audio", "audioplayers"] },
  svg: { type: "CustomPaint", packages: ["flutter_svg"] },
};

const TIER4_HTML_TAGS: Record<string, string> = {
  canvas: "HTML <canvas> uses imperative 2D or WebGL drawing code that has no static equivalent.",
  webgl: "WebGL rendering requires a shader and render-loop port.",
};

/**
 * Converts Web HTML & Tailwind/CSS structures into Flutterin WidgetNode IR.
 */
export class HtmlTailwindConverter {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
      textNodeName: "#text",
      unpairedTags: ["input", "img", "br", "hr", "meta", "link"],
    });
  }

  public parseHtml(htmlContent: string): WidgetNode {
    // Wrap in a single root element if multiple top-level elements exist
    const wrapped = `<root>${htmlContent}</root>`;
    const parsed = this.parser.parse(wrapped);
    const rootData = parsed.root;

    if (!rootData || typeof rootData !== "object") {
      return {
        type: "Container",
        properties: {},
        children: [],
      };
    }

    const childKeys = Object.keys(rootData).filter((k) => !k.startsWith("@_") && k !== "#text");
    if (childKeys.length === 0) {
      return {
        type: "Container",
        properties: {},
        children: [],
      };
    }

    if (childKeys.length === 1) {
      const tag = childKeys[0];
      const data = rootData[tag];
      if (Array.isArray(data)) {
        const children = data.map((item) => this.convertElement(tag, item));
        return {
          type: "Column",
          properties: {},
          children,
        };
      }
      return this.convertElement(tag, data);
    }

    // Multiple root elements -> wrap in Column
    const children: WidgetNode[] = [];
    for (const tag of childKeys) {
      const data = rootData[tag];
      if (Array.isArray(data)) {
        for (const item of data) {
          children.push(this.convertElement(tag, item));
        }
      } else {
        children.push(this.convertElement(tag, data));
      }
    }

    return {
      type: "Column",
      properties: {},
      children,
    };
  }

  private convertElement(tag: string, data: any): WidgetNode {
    const rawTag = tag.toLowerCase();
    const attrs = typeof data === "object" && data !== null ? data : {};
    const className = attrs["@_class"] || attrs["@_className"] || "";
    const rawTextContent = typeof data === "string" || typeof data === "number" ? data : (attrs["#text"] ?? "");
    const textContent = String(rawTextContent);

    const properties: WidgetPropertyMap = {};
    let widgetType: WidgetType = "Container";
    const children: WidgetNode[] = [];

    // Parse Tailwind classes
    this.applyTailwindClasses(className, properties);

    // Tier 2: embeds with a mature pub.dev package
    const tier2 = TIER2_HTML_TAGS[rawTag];
    if (tier2) {
      return withTierMeta(
        { type: tier2.type, rawSourceType: rawTag, properties, children: [] },
        ecosystemPluginMeta(tier2.packages)
      );
    }

    // Tier 4: imperative drawing that needs a user decision before any 0-to-1 build
    const tier4Reason = TIER4_HTML_TAGS[rawTag];
    if (tier4Reason) {
      return withTierMeta(
        { type: "CustomPaint", rawSourceType: rawTag, properties, children: [] },
        customBuildEscalation("web", `<${rawTag}>`, tier4Reason, {
          label: `Embed original <${rawTag}> via HtmlElementView or WebView`,
          description: "Host the original page fragment in a WebView (mobile) or HtmlElementView (web) and bridge events.",
        })
      );
    }

    switch (rawTag) {
      case "div":
      case "section":
      case "article":
      case "main":
      case "nav":
      case "form": {
        if (properties.isRow) {
          widgetType = "Row";
        } else if (properties.isColumn || !properties.isRow) {
          widgetType = "Column";
        }
        break;
      }

      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
      case "p":
      case "span":
      case "label": {
        widgetType = "Text";
        properties.text = textContent.trim();
        if (rawTag === "h1") {
          properties.fontSize = properties.fontSize || 32;
          properties.fontWeight = properties.fontWeight || "bold";
        } else if (rawTag === "h2") {
          properties.fontSize = properties.fontSize || 24;
          properties.fontWeight = properties.fontWeight || "bold";
        } else if (rawTag === "h3") {
          properties.fontSize = properties.fontSize || 20;
          properties.fontWeight = properties.fontWeight || "bold";
        }
        break;
      }

      case "button":
      case "a": {
        widgetType = "ElevatedButton";
        properties.text = textContent.trim() || "Button";
        break;
      }

      case "input": {
        const type = attrs["@_type"] || "text";
        if (type === "checkbox") {
          widgetType = "Checkbox";
        } else {
          widgetType = "TextField";
          properties.hintText = attrs["@_placeholder"] || "";
        }
        break;
      }

      case "textarea": {
        widgetType = "TextField";
        properties.hintText = attrs["@_placeholder"] || "";
        break;
      }

      case "progress": {
        widgetType = "CircularProgressIndicator";
        break;
      }

      case "img": {
        widgetType = "Image";
        properties.src = attrs["@_src"] || "assets/image.png";
        break;
      }

      default: {
        widgetType = "Container";
        break;
      }
    }

    // Process nested child elements
    if (typeof data === "object" && data !== null) {
      for (const [key, val] of Object.entries(data)) {
        if (key.startsWith("@_") || key === "#text") continue;

        if (Array.isArray(val)) {
          for (const item of val) {
            children.push(this.convertElement(key, item));
          }
        } else {
          children.push(this.convertElement(key, val));
        }
      }
    }

    return {
      type: widgetType,
      rawSourceType: rawTag,
      properties,
      children,
    };
  }

  private applyTailwindClasses(className: string, props: WidgetPropertyMap) {
    if (!className) return;
    const tokens = className.split(/\s+/).filter(Boolean);

    for (const token of tokens) {
      // Flex direction
      if (token === "flex") {
        props.isRow = true;
      } else if (token === "flex-col") {
        props.isColumn = true;
        props.isRow = false;
      } else if (token === "flex-row") {
        props.isRow = true;
        props.isColumn = false;
      }

      // Alignment
      if (token === "items-center") props.crossAlignment = "center";
      if (token === "items-start") props.crossAlignment = "start";
      if (token === "items-end") props.crossAlignment = "end";

      if (token === "justify-center") props.alignment = "center";
      if (token === "justify-between") props.alignment = "spaceBetween";
      if (token === "justify-around") props.alignment = "spaceAround";
      if (token === "justify-evenly") props.alignment = "spaceEvenly";

      // Padding
      const pMatch = token.match(/^p-(\d+)$/);
      if (pMatch) {
        const val = parseInt(pMatch[1], 10) * 4;
        props.padding = { top: val, bottom: val, left: val, right: val };
      }
      const pxMatch = token.match(/^px-(\d+)$/);
      if (pxMatch) {
        const val = parseInt(pxMatch[1], 10) * 4;
        props.padding = { ...props.padding, left: val, right: val };
      }
      const pyMatch = token.match(/^py-(\d+)$/);
      if (pyMatch) {
        const val = parseInt(pyMatch[1], 10) * 4;
        props.padding = { ...props.padding, top: val, bottom: val };
      }

      // Width / Height
      if (token === "w-full") props.width = "infinity";
      if (token === "h-full") props.height = "infinity";

      // Text sizes
      if (token === "text-xs") props.fontSize = 12;
      if (token === "text-sm") props.fontSize = 14;
      if (token === "text-base") props.fontSize = 16;
      if (token === "text-lg") props.fontSize = 18;
      if (token === "text-xl") props.fontSize = 20;
      if (token === "text-2xl") props.fontSize = 24;
      if (token === "text-3xl") props.fontSize = 30;

      // Font weight
      if (token === "font-bold") props.fontWeight = "bold";
      if (token === "font-semibold") props.fontWeight = "w600";
      if (token === "font-medium") props.fontWeight = "w500";

      // Rounded
      if (token === "rounded" || token === "rounded-md") props.borderRadius = 6;
      if (token === "rounded-lg") props.borderRadius = 8;
      if (token === "rounded-xl") props.borderRadius = 12;
      if (token === "rounded-2xl") props.borderRadius = 16;
      if (token === "rounded-full") props.borderRadius = 999;

      // Common Background colors
      if (token === "bg-white") props.backgroundColor = "FFFFFF";
      if (token === "bg-black") props.backgroundColor = "000000";
      if (token === "bg-blue-500" || token === "bg-blue-600") props.backgroundColor = "2563EB";
      if (token === "bg-gray-100" || token === "bg-slate-100") props.backgroundColor = "F1F5F9";
      if (token === "bg-red-500") props.backgroundColor = "EF4444";
      if (token === "bg-green-500") props.backgroundColor = "10B981";

      // Common Text colors
      if (token === "text-white") props.textColor = "FFFFFF";
      if (token === "text-black") props.textColor = "000000";
      if (token === "text-gray-500" || token === "text-slate-500") props.textColor = "64748B";
      if (token === "text-gray-900" || token === "text-slate-900") props.textColor = "0F172A";
    }
  }
}
