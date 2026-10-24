/**
 * JavaScript Source Map Reconstructor
 * Reconstructs original unminified TypeScript, React, and Vue source files from .js.map files or embedded base64 source maps.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface SourceMapV3 {
  version: number;
  file?: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names?: string[];
  mappings?: string;
}

export interface ReconstructedFile {
  relativePath: string;
  content: string;
  lineCount: number;
  frameworkDetected?: "React" | "Vue" | "Angular" | "Svelte" | "TypeScript" | "Standard";
}

export interface SourceMapReconstructionResult {
  totalFiles: number;
  files: ReconstructedFile[];
  detectedFrameworks: string[];
}

export class SourceMapReconstructor {
  public static extractEmbeddedSourceMap(jsContent: string): SourceMapV3 | null {
    const inlineRegex = /\/\/[#@]\s*sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/;
    const match = jsContent.match(inlineRegex);
    if (!match || !match[1]) return null;

    try {
      const decoded = Buffer.from(match[1], "base64").toString("utf8");
      return JSON.parse(decoded) as SourceMapV3;
    } catch {
      return null;
    }
  }

  public static parseSourceMap(mapContentOrJson: string | object): SourceMapV3 {
    if (typeof mapContentOrJson === "string") {
      return JSON.parse(mapContentOrJson) as SourceMapV3;
    }
    return mapContentOrJson as SourceMapV3;
  }

  public static reconstruct(mapData: SourceMapV3): SourceMapReconstructionResult {
    const files: ReconstructedFile[] = [];
    const frameworks = new Set<string>();

    if (!mapData.sources || !mapData.sourcesContent) {
      return { totalFiles: 0, files: [], detectedFrameworks: [] };
    }

    for (let i = 0; i < mapData.sources.length; i++) {
      const rawPath = mapData.sources[i];
      const content = mapData.sourcesContent[i];

      if (!content || !rawPath) continue;

      // Clean webpack://, vite://, node_modules, etc.
      let cleanPath = rawPath
        .replace(/^(webpack|vite|rollup|turbopack):\/\//, "")
        .replace(/^\.\//, "")
        .replace(/^[/\\]+/, "");

      // Ignore node_modules internals unless user wants them
      if (cleanPath.startsWith("node_modules/")) continue;

      const framework = SourceMapReconstructor.detectFramework(cleanPath, content);
      if (framework !== "Standard") {
        frameworks.add(framework);
      }

      files.push({
        relativePath: cleanPath,
        content,
        lineCount: content.split("\n").length,
        frameworkDetected: framework,
      });
    }

    return {
      totalFiles: files.length,
      files,
      detectedFrameworks: Array.from(frameworks),
    };
  }

  public static async writeReconstructedFiles(
    result: SourceMapReconstructionResult,
    outputDir: string
  ): Promise<string[]> {
    const writtenPaths: string[] = [];
    const resolvedBase = path.resolve(outputDir);

    for (const file of result.files) {
      const targetPath = path.resolve(resolvedBase, file.relativePath);
      if (!targetPath.startsWith(resolvedBase + path.sep) && targetPath !== resolvedBase) {
        continue;
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, file.content, "utf8");
      writtenPaths.push(targetPath);
    }

    return writtenPaths;
  }

  private static detectFramework(
    filePath: string,
    content: string
  ): "React" | "Vue" | "Angular" | "Svelte" | "TypeScript" | "Standard" {
    if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx") || content.includes("useState") || content.includes("React.createElement")) {
      return "React";
    }
    if (filePath.endsWith(".vue") || content.includes("<template>") || content.includes("defineComponent")) {
      return "Vue";
    }
    if (filePath.endsWith(".svelte") || content.includes("<script>") && content.includes("svelte")) {
      return "Svelte";
    }
    if (content.includes("@Component") || content.includes("@Injectable") || content.includes("ngOnInit")) {
      return "Angular";
    }
    if (filePath.endsWith(".ts")) {
      return "TypeScript";
    }
    return "Standard";
  }
}
