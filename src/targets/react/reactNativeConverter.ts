import type { WidgetNode, WidgetPropertyMap, WidgetType } from "../../ir/types.js";

/**
 * Converts React Native / React JSX components into Flutterin WidgetNode IR.
 */
export class ReactNativeConverter {
  /**
   * Parses JSX string into a WidgetNode tree.
   */
  public parseJsx(jsxCode: string): WidgetNode {
    // Strip export / component function wrapper if present
    let cleanJsx = jsxCode
      .replace(/{\s*\/\*[\s\S]*?\*\/\s*}/g, "") // remove JSX comments
      .replace(/<>([\s\S]*?)<\/>/g, "<Fragment>$1</Fragment>") // normalize shorthand fragments
      .replace(/<React\.Fragment[^>]*>([\s\S]*?)<\/React\.Fragment>/g, "<Fragment>$1</Fragment>")
      .replace(/style=\{\{([\s\S]*?)\}\}/g, (_m, inner) => {
        const escaped = inner.replace(/"/g, "'").replace(/\n/g, " ").replace(/>/g, "");
        return `rn-style="${escaped.trim()}"`;
      })
      .replace(/=\{\{([\s\S]*?)\}\}/g, (_m, expr) => {
        const safeExpr = String(expr).replace(/>/g, "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
        return `="${safeExpr}"`;
      })
      .replace(/=\{([^{}<>]*)\}/g, (_m, expr) => {
        const safeExpr = String(expr).replace(/>/g, "").replace(/"/g, "'").replace(/\s+/g, " ").trim();
        return `="${safeExpr}"`;
      })
      .trim();

    const returnParenMatch = cleanJsx.match(/return\s*\(\s*(<[\s\S]*>)\s*\)\s*;?/);
    const returnDirectMatch = !returnParenMatch ? cleanJsx.match(/return\s+(<[\s\S]*>)\s*;?/) : null;
    const arrowDirectMatch = !returnParenMatch && !returnDirectMatch ? cleanJsx.match(/=>\s*\(?\s*(<[\s\S]*>)\s*\)?\s*;?$/) : null;

    if (returnParenMatch) {
      cleanJsx = returnParenMatch[1].trim();
    } else if (returnDirectMatch) {
      cleanJsx = returnDirectMatch[1].trim();
    } else if (arrowDirectMatch) {
      cleanJsx = arrowDirectMatch[1].trim();
    }

    return this.parseNode(cleanJsx);
  }

  private parseNode(input: string): WidgetNode {
    const trimmed = input.trim();

    // Match opening tag: <TagName props...>
    const openTagMatch = trimmed.match(/^<([A-Za-z0-9_.]+)((?:[^>"']|"[^"]*"|'[^']*')*)(\/>|>([\s\S]*)<\/\1>)$/);
    if (!openTagMatch) {
      // Return Text if raw string
      return {
        type: "Text",
        properties: { text: trimmed.replace(/^{['"](.*)['"]}$/, "$1") },
        children: [],
      };
    }

    const [, tagName, rawProps, isSelfClosingOrBody, body] = openTagMatch;
    const isSelfClosing = isSelfClosingOrBody === "/>";

    let widgetType: WidgetType = "Container";
    const properties: WidgetPropertyMap = {};
    const children: WidgetNode[] = [];
    let conversionTier: import("../../ir/types.js").ConversionStrategyTier = "PURE_FLUTTER";
    let recommendedPackages: string[] | undefined;
    let escalation: import("../../ir/types.js").InteractiveEscalationSpec | undefined;

    // Parse props
    this.parseProps(rawProps || "", properties);

    // Map React Native & Web JSX components to Flutter
    switch (tagName) {
      case "Fragment":
      case "View":
      case "SafeAreaView":
      case "div":
      case "section":
      case "article":
      case "main": {
        if (properties.isRow) {
          widgetType = "Row";
        } else {
          widgetType = "Column";
        }
        break;
      }

      case "Text":
      case "span":
      case "p":
      case "h1":
      case "h2":
      case "h3":
      case "label": {
        widgetType = "Text";
        if (body && !body.includes("<")) {
          properties.text = body.trim().replace(/^{['"](.*)['"]}$/, "$1");
        }
        break;
      }

      case "TouchableOpacity":
      case "TouchableHighlight":
      case "Pressable":
      case "button": {
        widgetType = "ElevatedButton";
        if (body && body.includes("<Text")) {
          const textMatch = body.match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
          if (textMatch) {
            properties.text = textMatch[1].trim().replace(/^{['"](.*)['"]}$/, "$1");
          }
        } else if (body && !body.includes("<")) {
          properties.text = body.trim().replace(/^{['"](.*)['"]}$/, "$1");
        }
        properties.text = properties.text || "Tap Action";
        break;
      }

      case "Button": {
        widgetType = "ElevatedButton";
        properties.text = properties.text || "Button";
        break;
      }

      case "TextInput":
      case "input": {
        widgetType = "TextField";
        break;
      }

      case "Image":
      case "img": {
        widgetType = "Image";
        break;
      }

      case "ScrollView": {
        widgetType = "SingleChildScrollView";
        break;
      }

      case "FlatList": {
        widgetType = "ListView";
        break;
      }

      case "ActivityIndicator": {
        widgetType = "CircularProgressIndicator";
        break;
      }

      case "Switch": {
        widgetType = "Switch";
        break;
      }

      case "Canvas":
      case "Svg":
      case "GLView": {
        widgetType = "CustomPaint";
        conversionTier = "CUSTOM_BUILD_FROM_SCRATCH";
        escalation = {
          id: `esc_react_${tagName.toLowerCase()}`,
          sourceConstruct: tagName,
          sourcePlatform: "react",
          reason: `React Native custom graphics component '<${tagName}>' detected.`,
          recommendedTier: "CUSTOM_BUILD_FROM_SCRATCH",
          estimatedEffort: "heavy_custom_build",
          requiresUserConfirmation: true,
          options: [
            {
              optionId: "pure_flutter_custom",
              label: `Rebuild <${tagName}> in Pure Flutter CustomPainter`,
              description: "Port React Native Canvas 2D / WebGL drawing commands to Flutter CustomPainter.",
            },
          ],
        };
        break;
      }

      case "WebView": {
        widgetType = "PlatformView";
        conversionTier = "ECOSYSTEM_PLUGIN";
        recommendedPackages = ["flutter_inappwebview", "webview_flutter"];
        break;
      }

      default: {
        widgetType = "Container";
        break;
      }
    }

    // Parse children if not self-closing
    if (!isSelfClosing && body) {
      const childElements = this.extractChildTags(body.trim());
      for (const child of childElements) {
        children.push(this.parseNode(child));
      }
    }

    return {
      type: widgetType,
      rawSourceType: tagName,
      properties,
      children,
      conversionTier,
      recommendedPackages,
      escalation,
    };
  }

  private parseProps(rawProps: string, props: WidgetPropertyMap) {
    // Check title prop
    const titleMatch = rawProps.match(/title=["']([^"']+)["']/);
    if (titleMatch) props.text = titleMatch[1];

    // Check placeholder
    const placeholderMatch = rawProps.match(/placeholder=["']([^"']+)["']/);
    if (placeholderMatch) props.hintText = placeholderMatch[1];

    // Check source or src prop for Image
    const uriPropMatch = rawProps.match(/(?:src|source)=["']uri:\s*'([^']+)'["']/);
    const reqPropMatch = rawProps.match(/(?:src|source)=["']require\('([^']+)'\)["']/);
    const plainSrcMatch = rawProps.match(/(?:src|source)=["']([^"']+)["']/);
    if (uriPropMatch) {
      props.src = uriPropMatch[1];
    } else if (reqPropMatch) {
      props.src = reqPropMatch[1];
    } else if (plainSrcMatch) {
      props.src = plainSrcMatch[1];
    }

    // Check style prop
    const styleMatch = rawProps.match(/rn-style="([^"]*)"/) || rawProps.match(/rn-style='([^']*)'/);
    if (styleMatch) {
      const styleContent = styleMatch[1];
      if (/flexDirection\s*:\s*['"]row['"]/.test(styleContent)) {
        props.isRow = true;
      }
      if (/justifyContent\s*:\s*['"]center['"]/.test(styleContent)) {
        props.alignment = "center";
      }
      if (/justifyContent\s*:\s*['"]space-between['"]/.test(styleContent)) {
        props.alignment = "spaceBetween";
      }
      if (/alignItems\s*:\s*['"]center['"]/.test(styleContent)) {
        props.crossAlignment = "center";
      }

      const paddingMatch = styleContent.match(/padding\s*:\s*(\d+)/);
      if (paddingMatch) {
        const p = parseInt(paddingMatch[1], 10);
        props.padding = { top: p, bottom: p, left: p, right: p };
      }

      const bgMatch = styleContent.match(/backgroundColor\s*:\s*['"]#?([a-fA-F0-9]{3,6})['"]/);
      if (bgMatch) {
        props.backgroundColor = bgMatch[1];
      }

      const radiusMatch = styleContent.match(/borderRadius\s*:\s*(\d+)/);
      if (radiusMatch) {
        props.borderRadius = parseInt(radiusMatch[1], 10);
      }
    }
  }

  private extractChildTags(body: string): string[] {
    // Unwrap JSX embedded inside curly expressions like {isLogged && <View>...</View>} or {items.map(i => <Card />)}
    const unwrappedBody = body.replace(/\{([^{}]*<[A-Za-z0-9_.]+[\s\S]*?>)\}/g, (_full, inner: string) => {
      const firstTagIdx = inner.search(/<[A-Za-z0-9_.]+/);
      return firstTagIdx !== -1 ? inner.slice(firstTagIdx) : "";
    });

    const results: string[] = [];
    let depth = 0;
    let start = -1;
    let inQuote: string | null = null;
    let braceDepth = 0;

    for (let i = 0; i < unwrappedBody.length; i++) {
      const ch = unwrappedBody[i];
      if (inQuote) {
        if (ch === inQuote && unwrappedBody[i - 1] !== "\\") inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === "{") {
        braceDepth++;
        continue;
      }
      if (ch === "}") {
        braceDepth = Math.max(0, braceDepth - 1);
        continue;
      }
      if (braceDepth > 0) continue;

      if (ch === "<" && unwrappedBody[i + 1] !== "/") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "/" && unwrappedBody[i + 1] === ">") {
        depth = Math.max(0, depth - 1);
        if (depth === 0 && start !== -1) {
          results.push(unwrappedBody.substring(start, i + 2));
          start = -1;
          i++;
        }
      } else if (ch === "<" && unwrappedBody[i + 1] === "/") {
        const endClose = unwrappedBody.indexOf(">", i);
        if (endClose !== -1) {
          depth = Math.max(0, depth - 1);
          if (depth === 0 && start !== -1) {
            results.push(unwrappedBody.substring(start, endClose + 1));
            start = -1;
            i = endClose;
          }
        }
      }
    }

    if (results.length === 0 && unwrappedBody.trim().length > 0) {
      results.push(unwrappedBody.trim());
    }

    return results;
  }
}
