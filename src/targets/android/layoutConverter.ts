import { XMLParser } from "fast-xml-parser";
import type { WidgetNode, WidgetPropertyMap, WidgetType } from "../../ir/types.js";
import { hybridBridgeEscalation } from "../../ir/escalation.js";

import { AxmlParser } from "../../core/decoders/axmlParser.js";

export interface AndroidResourceTables {
  dimens?: Record<string, number> | Map<string, number>;
  strings?: Record<string, string> | Map<string, string>;
  colors?: Record<string, string> | Map<string, string>;
}

/**
 * Converts Android XML Layout declarations (decompiled via apktool/jadx, raw AXML, or ADB uiautomator)
 * into Flutterin WidgetNode Intermediate Representation.
 */
export class AndroidLayoutConverter {
  private parser: XMLParser;
  private dimensMap = new Map<string, number>();
  private stringsMap = new Map<string, string>();
  private colorsMap = new Map<string, string>();

  constructor(resources?: AndroidResourceTables) {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      trimValues: true,
    });
    if (resources) {
      this.setResourceTable(resources);
    }
  }

  /**
   * Sets or updates symbol tables for @dimen, @string, and @color resolution.
   */
  public setResourceTable(resources: AndroidResourceTables): void {
    if (resources.dimens) {
      if (resources.dimens instanceof Map) {
        for (const [k, v] of resources.dimens.entries()) this.dimensMap.set(k, v);
      } else {
        for (const [k, v] of Object.entries(resources.dimens)) this.dimensMap.set(k, v);
      }
    }
    if (resources.strings) {
      if (resources.strings instanceof Map) {
        for (const [k, v] of resources.strings.entries()) this.stringsMap.set(k, v);
      } else {
        for (const [k, v] of Object.entries(resources.strings)) this.stringsMap.set(k, v);
      }
    }
    if (resources.colors) {
      if (resources.colors instanceof Map) {
        for (const [k, v] of resources.colors.entries()) this.colorsMap.set(k, v);
      } else {
        for (const [k, v] of Object.entries(resources.colors)) this.colorsMap.set(k, v);
      }
    }
  }

  /**
   * Parses Android XML string or binary AXML into a root WidgetNode.
   */
  public parseXml(xmlContent: string | Buffer): WidgetNode {
    let contentStr: string;

    if (Buffer.isBuffer(xmlContent)) {
      if (xmlContent.length >= 4 && xmlContent.readUInt32LE(0) === 0x00080003) {
        const axml = new AxmlParser(xmlContent);
        const node = axml.parse();
        contentStr = axml.toXml(node);
      } else {
        contentStr = xmlContent.toString("utf8");
      }
    } else {
      // Check if it's base64 encoded binary AXML
      if (xmlContent.startsWith("AwAA") || xmlContent.startsWith("AwAIA")) {
        try {
          const buf = Buffer.from(xmlContent, "base64");
          if (buf.length >= 4 && buf.readUInt32LE(0) === 0x00080003) {
            const axml = new AxmlParser(buf);
            const node = axml.parse();
            contentStr = axml.toXml(node);
          } else {
            contentStr = xmlContent;
          }
        } catch {
          contentStr = xmlContent;
        }
      } else {
        contentStr = xmlContent;
      }
    }

    const parsed = this.parser.parse(contentStr);
    const rootKey = Object.keys(parsed).find((k) => !k.startsWith("?") && !k.startsWith("@_"));
    if (!rootKey) {
      throw new Error("Empty or invalid XML layout.");
    }
    return this.convertElement(rootKey, parsed[rootKey]);
  }

  private convertElement(tag: string, elementData: any): WidgetNode {
    let rawTag = tag.split(".").pop() || tag;
    const attrs = elementData || {};

    // Support ADB uiautomator dump trees (<node class="android.widget.TextView" text="...">)
    if ((rawTag === "node" || rawTag === "hierarchy") && attrs["@_class"]) {
      const cls = String(attrs["@_class"]);
      rawTag = cls.split(".").pop() || rawTag;
    }

    let widgetType: WidgetType = "Container";
    const properties: WidgetPropertyMap = {};
    const children: WidgetNode[] = [];

    // Parse attributes
    const widthAttr = attrs["@_layout_width"] || attrs["@_bounds"];
    const heightAttr = attrs["@_layout_height"];
    if (widthAttr === "match_parent" || widthAttr === "fill_parent") {
      properties.width = "infinity";
    }
    if (heightAttr === "match_parent" || heightAttr === "fill_parent") {
      properties.height = "infinity";
    }
    if (widthAttr === "0dp" || widthAttr === "0dip") {
      properties.isExpanded = true;
      properties.flex = properties.flex || 1;
    }

    const padding = this.parseEdgeInsets(attrs, "padding");
    if (padding) {
      properties.padding = padding;
    }
    const margin = this.parseEdgeInsets(attrs, "layout_margin");
    if (margin) {
      properties.margin = margin;
    }
    const weight = parseFloat(String(attrs["@_layout_weight"] ?? ""));
    if (!isNaN(weight) && weight > 0) {
      properties.flex = Math.max(1, Math.round(weight));
      properties.isExpanded = true;
    }
    if (typeof attrs["@_background"] === "string") {
      if (attrs["@_background"].startsWith("#")) {
        properties.backgroundColor = attrs["@_background"].replace("#", "");
      } else if (attrs["@_background"].startsWith("@color/")) {
        const resolved = this.cleanResourceValue(attrs["@_background"]);
        if (resolved.startsWith("#")) properties.backgroundColor = resolved.replace("#", "");
      }
    }
    if (typeof attrs["@_textColor"] === "string") {
      if (attrs["@_textColor"].startsWith("#")) {
        properties.textColor = attrs["@_textColor"].replace("#", "");
      } else if (attrs["@_textColor"].startsWith("@color/")) {
        const resolved = this.cleanResourceValue(attrs["@_textColor"]);
        if (resolved.startsWith("#")) properties.textColor = resolved.replace("#", "");
      }
    }

    const orientation = attrs["@_orientation"] || "vertical";
    const gravity = attrs["@_gravity"] || "";
    let conversionTier: import("../../ir/types.js").ConversionStrategyTier = "PURE_FLUTTER";
    let recommendedPackages: string[] | undefined;
    let escalation: import("../../ir/types.js").InteractiveEscalationSpec | undefined;

    // Map Android tags to Flutter Widgets
    switch (rawTag) {
      case "LinearLayout": {
        widgetType = orientation === "horizontal" ? "Row" : "Column";
        if (gravity.includes("center")) {
          properties.alignment = "center";
          properties.crossAlignment = "center";
        }
        break;
      }

      case "ConstraintLayout": {
        widgetType = this.resolveConstraintLayout(attrs);
        break;
      }

      case "RelativeLayout":
      case "FrameLayout":
      case "CoordinatorLayout": {
        widgetType = "Stack";
        break;
      }

      case "AppBarLayout": {
        widgetType = "Column";
        break;
      }

      case "Toolbar":
      case "MaterialToolbar": {
        widgetType = "AppBar";
        properties.title = this.cleanResourceValue(attrs["@_title"] || "");
        break;
      }

      case "MaterialDivider":
      case "Divider": {
        widgetType = "Divider";
        break;
      }

      case "BottomSheetDragHandleView": {
        widgetType = "Container";
        properties.width = 36;
        properties.height = 4;
        properties.borderRadius = 2;
        break;
      }

      case "ScrollView":
      case "NestedScrollView": {
        widgetType = "SingleChildScrollView";
        break;
      }

      case "RecyclerView":
      case "ListView": {
        widgetType = "ListView";
        break;
      }

      case "TextView":
      case "MaterialTextView": {
        widgetType = "Text";
        properties.text = this.cleanResourceValue(attrs["@_text"] || attrs["@_content-desc"] || "Text View");
        const textSize = this.parseDimension(attrs["@_textSize"]);
        if (textSize) properties.fontSize = textSize;
        if (attrs["@_textStyle"] === "bold") properties.fontWeight = "bold";
        break;
      }

      case "Button":
      case "MaterialButton": {
        widgetType = "ElevatedButton";
        properties.text = this.cleanResourceValue(attrs["@_text"] || attrs["@_content-desc"] || "Button");
        break;
      }

      case "CardView":
      case "MaterialCardView": {
        widgetType = "Card";
        break;
      }

      case "FloatingActionButton":
      case "ExtendedFloatingActionButton": {
        widgetType = "FloatingActionButton";
        break;
      }

      case "ImageButton": {
        widgetType = "IconButton";
        break;
      }

      case "SeekBar":
      case "Slider": {
        widgetType = "Slider";
        break;
      }

      case "EditText":
      case "TextInputEditText": {
        widgetType = "TextField";
        properties.hintText = this.cleanResourceValue(attrs["@_hint"] || attrs["@_text"] || "");
        break;
      }

      case "ImageView":
      case "ShapeableImageView": {
        widgetType = "Image";
        properties.src = this.cleanResourceValue(attrs["@_src"] || "assets/image.png");
        break;
      }

      case "ProgressBar": {
        widgetType = "CircularProgressIndicator";
        break;
      }

      case "LinearProgressIndicator": {
        widgetType = "LinearProgressIndicator";
        break;
      }

      case "Switch":
      case "SwitchCompat":
      case "MaterialSwitch": {
        widgetType = "Switch";
        break;
      }

      case "CheckBox":
      case "MaterialCheckBox": {
        widgetType = "Checkbox";
        break;
      }

      case "WebView":
      case "MapView":
      case "SupportMapFragment":
      case "VideoView":
      case "PlayerView":
      case "PreviewView":
      case "CameraView": {
        widgetType = "PlatformView";
        conversionTier = "ECOSYSTEM_PLUGIN";
        recommendedPackages =
          rawTag === "WebView"
            ? ["webview_flutter", "flutter_inappwebview"]
            : rawTag.includes("Map")
            ? ["google_maps_flutter", "flutter_map"]
            : rawTag.includes("Video") || rawTag.includes("Player")
            ? ["video_player", "media_kit"]
            : ["camera"];
        break;
      }

      case "SurfaceView":
      case "TextureView": {
        widgetType = "PlatformView";
        conversionTier = "HYBRID_BRIDGE";
        const meta = hybridBridgeEscalation(
          "android",
          rawTag,
          `Native view '${rawTag}' requires hardware rendering pipeline or native OS surface. Requires AndroidView texture bridge.`
        );
        escalation = meta.escalation;
        break;
      }

      case "GLSurfaceView":
      case "VulkanSurfaceView": {
        widgetType = "CustomPaint";
        conversionTier = "CUSTOM_BUILD_FROM_SCRATCH";
        escalation = {
          id: `esc_android_${rawTag.toLowerCase()}`,
          sourceConstruct: tag,
          sourcePlatform: "android",
          reason: `Native GPU surface '${rawTag}' uses custom OpenGL/Vulkan rendering pipeline.`,
          recommendedTier: "CUSTOM_BUILD_FROM_SCRATCH",
          estimatedEffort: "heavy_custom_build",
          requiresUserConfirmation: true,
          options: [
            {
              optionId: "pure_flutter_custom",
              label: "Rebuild with Flutter CustomPainter / FragmentShader",
              description: "Port shader/canvas rendering into Dart CustomPainter or Flutter Impeller FragmentProgram.",
            },
            {
              optionId: "hybrid_native_bridge",
              label: "Keep Native Surface via AndroidView Texture Bridge",
              description: "Host the native OpenGL/Vulkan surface via Flutter TextureRegistry / AndroidView.",
            },
          ],
        };
        break;
      }

      default: {
        widgetType = "Container";
        if (tag.includes(".") && !tag.startsWith("android.") && !tag.startsWith("androidx.") && !tag.startsWith("com.google.android.material.")) {
          conversionTier = "CUSTOM_BUILD_FROM_SCRATCH";
          escalation = {
            id: `esc_custom_view_${rawTag.toLowerCase()}`,
            sourceConstruct: tag,
            sourcePlatform: "android",
            reason: `Bespoke custom Android View '${tag}' detected; may contain custom onDraw(Canvas) or touch handling.`,
            recommendedTier: "CUSTOM_BUILD_FROM_SCRATCH",
            estimatedEffort: "heavy_custom_build",
            requiresUserConfirmation: true,
            options: [
              {
                optionId: "pure_flutter_custom",
                label: `Rebuild '${rawTag}' from 0 in Pure Flutter`,
                description: "Decompile the custom View's onDraw/onTouchEvent via JADX and port to Flutter CustomPainter/GestureDetector.",
              },
              {
                optionId: "hybrid_native_bridge",
                label: `Embed original '${rawTag}' via AndroidView PlatformView`,
                description: "Register a PlatformViewFactory in Kotlin MainActivity and mount via AndroidView.",
              },
            ],
          };
        }
        break;
      }
    }

    // Process nested child elements
    for (const [key, val] of Object.entries(attrs)) {
      if (key.startsWith("@_") || key === "#text") continue;

      if (Array.isArray(val)) {
        for (const item of val) {
          children.push(this.convertElement(key, item));
        }
      } else if (typeof val === "object" && val !== null) {
        children.push(this.convertElement(key, val));
      }
    }

    return {
      type: widgetType,
      rawSourceType: rawTag,
      properties,
      children,
      conversionTier,
      recommendedPackages,
      escalation,
    };
  }

  private parseEdgeInsets(attrs: Record<string, any>, prefix: "padding" | "layout_margin"): WidgetPropertyMap["padding"] | undefined {
    const all = this.parseDimension(attrs[`@_${prefix}`]);
    const horiz = this.parseDimension(attrs[`@_${prefix}Horizontal`]);
    const vert = this.parseDimension(attrs[`@_${prefix}Vertical`]);
    const start = this.parseDimension(attrs[`@_${prefix}Start`]);
    const end = this.parseDimension(attrs[`@_${prefix}End`]);
    const left = this.parseDimension(attrs[`@_${prefix}Left`]);
    const right = this.parseDimension(attrs[`@_${prefix}Right`]);
    const top = this.parseDimension(attrs[`@_${prefix}Top`]);
    const bottom = this.parseDimension(attrs[`@_${prefix}Bottom`]);

    const effLeft = left ?? start ?? horiz ?? all;
    const effRight = right ?? end ?? horiz ?? all;
    const effTop = top ?? vert ?? all;
    const effBottom = bottom ?? vert ?? all;

    if (effLeft !== undefined || effRight !== undefined || effTop !== undefined || effBottom !== undefined) {
      return {
        top: effTop ?? 0,
        bottom: effBottom ?? 0,
        left: effLeft ?? 0,
        right: effRight ?? 0,
      };
    }
    return undefined;
  }

  private resolveConstraintLayout(elementData: any): WidgetType {
    const childAttrs: Record<string, any>[] = [];
    const childTags: string[] = [];

    for (const [key, val] of Object.entries(elementData || {})) {
      if (key.startsWith("@_") || key === "#text") continue;
      const rawChildTag = key.split(".").pop() || key;
      if (Array.isArray(val)) {
        for (const item of val) {
          childTags.push(rawChildTag);
          childAttrs.push(item || {});
        }
      } else if (typeof val === "object" && val !== null) {
        childTags.push(rawChildTag);
        childAttrs.push(val);
      }
    }

    if (childAttrs.length === 0) return "Container";

    // Detect horizontal connections
    const hasHorizontalChain = childAttrs.some(
      (c) =>
        c["@_layout_constraintStart_toEndOf"] ||
        c["@_layout_constraintEnd_toStartOf"] ||
        c["@_layout_constraintLeft_toRightOf"] ||
        c["@_layout_constraintRight_toLeftOf"]
    );

    // Detect vertical connections
    const hasVerticalChain = childAttrs.some(
      (c) =>
        c["@_layout_constraintTop_toBottomOf"] ||
        c["@_layout_constraintBottom_toTopOf"]
    );

    if (hasHorizontalChain && !hasVerticalChain) return "Row";
    if (hasVerticalChain && !hasHorizontalChain) return "Column";

    // No explicit chain — check if layout resembles a ListTile / Card (Icon + Text + Action side-by-side)
    const hasImageOrIcon = childTags.some((t) => t.includes("Image") || t.includes("Icon"));
    const hasText = childTags.some((t) => t.includes("Text"));
    const hasControl = childTags.some((t) => t.includes("Switch") || t.includes("Button") || t.includes("Check"));
    if (hasImageOrIcon && hasText && hasControl) {
      return "Card";
    }

    // Check for obvious overlay (e.g. ProgressBar over a list/view)
    const hasOverlayIndicator = childTags.some((t) => t.includes("Progress") || t.includes("Indicator") || t.includes("FAB") || t.includes("FloatingActionButton"));
    if (hasOverlayIndicator && childAttrs.length > 1) {
      return "Stack";
    }

    // Default to Column if standard flow, otherwise Stack
    return hasVerticalChain ? "Column" : "Stack";
  }

  private parseDimension(val?: string): number | undefined {
    if (!val) return undefined;
    if (val.startsWith("@dimen/")) {
      const dimenKey = val.replace("@dimen/", "");
      if (this.dimensMap.has(dimenKey)) {
        return this.dimensMap.get(dimenKey);
      }
    }
    const match = val.match(/^(\d+(?:\.\d+)?)(?:dp|sp|px|dip)?$/);
    return match ? parseFloat(match[1]) : undefined;
  }

  private cleanResourceValue(val: string): string {
    if (!val) return "";
    if (val.startsWith("@string/")) {
      const strKey = val.replace("@string/", "");
      if (this.stringsMap.has(strKey)) {
        return this.stringsMap.get(strKey)!;
      }
      return strKey;
    }
    if (val.startsWith("@color/")) {
      const colorKey = val.replace("@color/", "");
      if (this.colorsMap.has(colorKey)) {
        return this.colorsMap.get(colorKey)!;
      }
    }
    return val;
  }
}
