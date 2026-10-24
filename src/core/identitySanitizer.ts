/**
 * Clean-Room Identity & Fingerprint Sanitizer
 *
 * Automatically detects the user's target project/workspace identity (from CLI options,
 * pubspec.yaml, package.json, or workspace directory) and strips source application
 * fingerprints, package IDs, and platform object prefixes (activity_, fragment_, etc.)
 * from all generated file names, class names, package imports, and UI strings.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface TargetProjectIdentity {
  /** Human-readable application name (e.g. "MySuperApp") */
  appName: string;
  /** Dart pubspec snake_case package name (e.g. "my_super_app") */
  dartPackageName: string;
  /** PascalCase prefix for classes when needed (e.g. "MySuperApp") */
  pascalPrefix: string;
  /** Reverse-domain package identifier (e.g. "com.mysuperapp.app") */
  packageId: string;
  /** Tokens identified as belonging to the reverse-engineered source artifact */
  sourceFingerprintTokens: string[];
}

export interface IdentityResolutionOptions {
  /** Explicit app/project name provided by user */
  userAppName?: string;
  /** Explicit package ID provided by user (e.g. com.mycompany.app) */
  userPackageId?: string;
  /** Path to the input artifact being reverse-engineered */
  sourceArtifactPath?: string;
  /** Extracted package ID from the source artifact (e.g. com.competitor.app) */
  detectedSourcePackageId?: string;
  /** Extracted app label from the source artifact */
  detectedSourceAppName?: string;
  /** Target output directory or workspace root */
  workspaceDir?: string;
}

const GENERIC_PACKAGE_SEGMENTS = new Set([
  "com", "org", "net", "io", "co", "id", "app", "mobile", "android", "ios",
  "client", "core", "main", "base", "release", "debug", "prod", "staging",
  "flutter", "react", "electron", "web", "apk", "aab", "ipa", "asar", "unpacked",
  // Protected Dart/Flutter AST & SDK tokens
  "text", "view", "page", "screen", "home", "login", "auth", "user", "item",
  "list", "card", "grid", "row", "column", "stack", "button", "icon", "image",
  "data", "model", "service", "state", "widget", "build", "context", "color",
  "style", "theme", "padding", "margin", "center", "scaffold", "material",
]);

const OBJECT_TYPE_PREFIXES = /^(?:activity|fragment|dialog|layout|partial|include|item|view|cell|page|screen|vc|uiview|nsview)[-_]+/i;
const OBJECT_TYPE_SUFFIXES = /[-_]+(?:activity|fragment|dialog|layout|view|vc|page|screen)$/i;

export class IdentitySanitizer {
  /**
   * Resolves the clean target project identity from user overrides or workspace manifests,
   * and builds the blacklist of source fingerprint tokens to purge.
   */
  public static resolveIdentity(options: IdentityResolutionOptions = {}): TargetProjectIdentity {
    const workspaceRoot = options.workspaceDir
      ? path.resolve(options.workspaceDir)
      : process.cwd();

    // 1. Discover target project name (User Override -> pubspec.yaml -> package.json -> CWD)
    const discoveredName =
      options.userAppName?.trim() ||
      this.readPubspecName(workspaceRoot) ||
      this.readPubspecName(process.cwd()) ||
      this.readPackageJsonName(workspaceRoot) ||
      this.readPackageJsonName(process.cwd()) ||
      this.inferCleanWorkspaceDirName(workspaceRoot, options.sourceArtifactPath);

    const dartPackageName = this.toSnakeCase(discoveredName) || "flutter_app";
    const pascalPrefix = this.toPascalCase(dartPackageName) || "FlutterApp";
    const appName = options.userAppName?.trim() || pascalPrefix;

    const packageId =
      options.userPackageId?.trim() ||
      `com.${dartPackageName.replace(/_/g, "")}.app`;

    // 2. Collect source fingerprint tokens to strip during conversion
    const fingerprintSet = new Set<string>();

    if (options.sourceArtifactPath) {
      const base = path.basename(options.sourceArtifactPath, path.extname(options.sourceArtifactPath));
      for (const token of this.splitTokens(base)) {
        if (token.length >= 3 && !GENERIC_PACKAGE_SEGMENTS.has(token) && token !== dartPackageName) {
          fingerprintSet.add(token);
        }
      }
    }

    if (options.detectedSourcePackageId) {
      for (const segment of options.detectedSourcePackageId.split(/[._-]+/)) {
        const lower = segment.toLowerCase();
        if (lower.length >= 3 && !GENERIC_PACKAGE_SEGMENTS.has(lower) && tokenNotGeneric(lower, dartPackageName)) {
          fingerprintSet.add(lower);
        }
      }
    }

    if (options.detectedSourceAppName) {
      for (const token of this.splitTokens(options.detectedSourceAppName)) {
        if (token.length >= 3 && !GENERIC_PACKAGE_SEGMENTS.has(token) && token !== dartPackageName) {
          fingerprintSet.add(token);
        }
      }
    }

    return {
      appName,
      dartPackageName,
      pascalPrefix,
      packageId,
      sourceFingerprintTokens: Array.from(fingerprintSet),
    };
  }

  /**
   * Sanitizes a raw layout/component/class name from a reverse-engineered artifact
   * into a clean, fingerprint-free Flutter screen name and file name.
   */
  public static sanitizeScreenIdentifier(
    rawLayoutOrComponentName: string,
    identity: TargetProjectIdentity
  ): { className: string; fileName: string; cleanBaseName: string } {
    let base = rawLayoutOrComponentName
      .replace(/\.(xml|jsx|tsx|swift|html|vue|dart)$/i, "")
      .trim();

    // Strip Android/iOS object type prefixes and suffixes (activity_, fragment_, etc.)
    base = base.replace(OBJECT_TYPE_PREFIXES, "").replace(OBJECT_TYPE_SUFFIXES, "");

    // Split into tokens and remove source application fingerprint tokens
    const rawTokens = this.splitTokens(base);
    const filteredTokens = rawTokens.filter(
      (t) => !identity.sourceFingerprintTokens.includes(t.toLowerCase())
    );

    const effectiveTokens = filteredTokens.length > 0 ? filteredTokens : ["main"];
    const rawSnake = effectiveTokens.join("_").toLowerCase().replace(/_screen$/, "") || "main";
    const cleanSnake = /^[0-9]/.test(rawSnake) ? `s_${rawSnake}` : rawSnake;

    const rawPascal = this.toPascalCase(cleanSnake) || "Main";
    const pascalBase = /^[0-9]/.test(rawPascal) ? `S${rawPascal}` : rawPascal;
    const className = pascalBase.endsWith("Screen") ? pascalBase : `${pascalBase}Screen`;
    const fileName = `${cleanSnake}_screen.dart`;

    return {
      className,
      fileName,
      cleanBaseName: pascalBase,
    };
  }

  /**
   * Sanitizes a reconstructed class or model identifier by stripping source fingerprints.
   */
  public static sanitizeClassName(rawClassName: string, identity: TargetProjectIdentity): string {
    const tokens = this.splitTokens(rawClassName);
    const cleaned = tokens.filter(
      (t) => !identity.sourceFingerprintTokens.includes(t.toLowerCase())
    );
    if (cleaned.length === 0) {
      return `${identity.pascalPrefix}Model`;
    }
    const pascal = this.toPascalCase(cleaned.join("_"));
    return /^[0-9]/.test(pascal) ? `M${pascal}` : pascal;
  }

  /**
   * Rewrites package: URIs and reverse-domain package IDs in recovered strings or code.
   */
  public static sanitizeCodeAndStrings(
    rawText: string,
    identity: TargetProjectIdentity,
    sourcePackageId?: string
  ): string {
    let output = rawText;

    // 1. Replace package:<source_pkg>/ with package:<target_dart_pkg>/
    output = output.replace(
      /package:([a-zA-Z0-9_]+)\//g,
      (fullMatch, pkgName: string) => {
        if (pkgName === "flutter" || pkgName === "flutter_riverpod" || pkgName === "dio" || pkgName === "drift" || pkgName === "go_router") {
          return fullMatch;
        }
        if (
          identity.sourceFingerprintTokens.some((fp) => pkgName.toLowerCase().includes(fp)) ||
          pkgName === "app"
        ) {
          return `package:${identity.dartPackageName}/`;
        }
        return fullMatch;
      }
    );

    // 2. Replace explicit source package ID (e.g. com.competitor.app) with target packageId
    if (sourcePackageId && sourcePackageId.trim().length > 0) {
      const escapedPkg = sourcePackageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      output = output.replace(new RegExp(escapedPkg, "g"), identity.packageId);
    }

    // 3. Replace source brand tokens strictly inside single-quoted string literals (excluding import statements)
    for (const token of identity.sourceFingerprintTokens) {
      if (token.length >= 4 && !GENERIC_PACKAGE_SEGMENTS.has(token.toLowerCase())) {
        const tokenRegex = new RegExp(`\\b${token}\\b`, "gi");
        output = output
          .split("\n")
          .map((line) => {
            if (line.trimStart().startsWith("import ")) return line;
            return line.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (lit) => lit.replace(tokenRegex, identity.appName));
          })
          .join("\n");
      }
    }

    return output;
  }

  /**
   * Cleans legacy native Android Gradle configurations, unused AndroidX UI dependencies,
   * orphan XML styles, and synchronizes root workspace documentation with the target identity.
   */
  public static sanitizeAndroidGradleAndRes(
    workspaceDir: string,
    options: { keptCapabilities?: string[]; identity?: TargetProjectIdentity } = {}
  ): { prunedDependencies: string[]; prunedStyles: string[]; syncedReadme: boolean } {
    const prunedDependencies: string[] = [];
    const prunedStyles: string[] = [];
    let syncedReadme = false;

    const androidAppBuildGradle = path.join(workspaceDir, "android", "app", "build.gradle.kts");
    const androidSettingsGradle = path.join(workspaceDir, "android", "settings.gradle.kts");

    // 1. Sanitize android/app/build.gradle.kts
    if (fs.existsSync(androidAppBuildGradle)) {
      try {
        const content = fs.readFileSync(androidAppBuildGradle, "utf8");
        const lines = content.split("\n");
        const cleanedLines: string[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (
            trimmed.includes("androidx.navigation.safeargs.kotlin") ||
            trimmed.includes("navigation-fragment-ktx") ||
            trimmed.includes("navigation-ui-ktx") ||
            trimmed.includes("constraintlayout") ||
            trimmed.includes("com.google.code.gson:gson") ||
            trimmed === "viewBinding = true" ||
            trimmed === "buildFeatures { viewBinding = true }"
          ) {
            prunedDependencies.push(trimmed);
            continue;
          }
          cleanedLines.push(line);
        }

        const newContent = cleanedLines.join("\n");
        if (newContent !== content) {
          fs.writeFileSync(androidAppBuildGradle, newContent, "utf8");
        }
      } catch {}
    }

    // 2. Sanitize android/settings.gradle.kts
    if (fs.existsSync(androidSettingsGradle)) {
      try {
        const content = fs.readFileSync(androidSettingsGradle, "utf8");
        const lines = content.split("\n");
        const cleanedLines: string[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.includes("androidx.navigation.safeargs.kotlin")) {
            prunedDependencies.push(trimmed);
            continue;
          }
          cleanedLines.push(line);
        }

        const newContent = cleanedLines.join("\n");
        if (newContent !== content) {
          fs.writeFileSync(androidSettingsGradle, newContent, "utf8");
        }
      } catch {}
    }

    // 3. Sanitize orphan styles in styles.xml (e.g. Doki.*)
    const stylesXmlPath = path.join(workspaceDir, "android", "app", "src", "main", "res", "values", "styles.xml");
    if (fs.existsSync(stylesXmlPath)) {
      try {
        let content = fs.readFileSync(stylesXmlPath, "utf8");
        const keepDoki = options.keptCapabilities?.includes("doki") || false;
        if (!keepDoki && content.includes('name="Doki.')) {
          const styleRegex = /<style\s+name="Doki\.[^"]*"[\s\S]*?<\/style>/g;
          for (const m of content.match(styleRegex) || []) {
            const nameMatch = m.match(/name="([^"]+)"/);
            if (nameMatch) prunedStyles.push(nameMatch[1]);
          }
          content = content.replace(styleRegex, "");
          fs.writeFileSync(stylesXmlPath, content, "utf8");
        }
      } catch {}
    }

    // 4. Synchronize root README.md with target identity if BLUEPRINT exists
    const blueprintPath = path.join(workspaceDir, "context", "00_Strategy", "BLUEPRINT.md");
    const readmePath = path.join(workspaceDir, "README.md");
    if (fs.existsSync(blueprintPath) && fs.existsSync(readmePath) && options.identity) {
      try {
        const readme = fs.readFileSync(readmePath, "utf8");
        if (!readme.includes(options.identity.appName)) {
          const header = `# ${options.identity.appName}\n\nClean-Room Flutter 3 reconstructed application.\nSee [BLUEPRINT](context/00_Strategy/BLUEPRINT.md) for architectural specifications.\n\n`;
          fs.writeFileSync(readmePath, header + readme, "utf8");
          syncedReadme = true;
        }
      } catch {}
    }

    return { prunedDependencies, prunedStyles, syncedReadme };
  }

  private static readPubspecName(dir: string): string | null {
    const pubspecPath = path.join(dir, "pubspec.yaml");
    if (!fs.existsSync(pubspecPath)) return null;
    try {
      const content = fs.readFileSync(pubspecPath, "utf8");
      const match = content.match(/^name:\s*([a-zA-Z0-9_]+)/m);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  private static readPackageJsonName(dir: string): string | null {
    const pkgPath = path.join(dir, "package.json");
    if (!fs.existsSync(pkgPath)) return null;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg?.name && pkg.name !== "flutterin" && pkg.name !== "rea-agents") {
        return String(pkg.name).replace(/^@[^/]+\//, "");
      }
      return null;
    } catch {
      return null;
    }
  }

  private static inferCleanWorkspaceDirName(workspaceRoot: string, sourceArtifactPath?: string): string {
    const folderName = path.basename(workspaceRoot);
    const sourceBase = sourceArtifactPath
      ? path.basename(sourceArtifactPath, path.extname(sourceArtifactPath)).toLowerCase()
      : "";

    // If the output folder was auto-named after the APK (e.g., myapp_flutterin), use CWD instead
    if (sourceBase && folderName.toLowerCase().includes(sourceBase)) {
      const cwdName = path.basename(process.cwd());
      if (cwdName && cwdName !== "flutterin" && !cwdName.toLowerCase().includes(sourceBase)) {
        return cwdName;
      }
      return "reconstructed_app";
    }
    if (folderName === "flutterin" || folderName === "lib" || folderName === "context") {
      return "reconstructed_app";
    }
    return folderName || "reconstructed_app";
  }

  private static splitTokens(input: string): string[] {
    return input
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .split("_")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }

  public static toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z]+)(?=[A-Z][a-z])|([a-z0-9])(?=[A-Z])/g, "$&_")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .replace(/^_+|_+$/g, "");
  }

  public static toPascalCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[^a-zA-Z0-9]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join("");
  }
}

function tokenNotGeneric(token: string, dartPackageName: string): boolean {
  return !GENERIC_PACKAGE_SEGMENTS.has(token) && token !== dartPackageName;
}
