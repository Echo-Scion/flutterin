/**
 * Context Generator for .agents Epistemic Auto-Context Protocol (82-File Matrix)
 * 
 * Inspects source directories and reverse-engineered artifacts (Android manifests, layouts,
 * SQLite databases, HAR captures, and SDK dependencies) to selectively populate the
 * 82-file SaaS Context Matrix with deterministic epistemic tags and non-destructive merge anchors.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { HarSqliteInspector } from "../core/decoders/harSqliteInspector.js";
import { AxmlParser } from "../core/decoders/axmlParser.js";
import { MechanicalGuard } from "../core/mechanicalGuard.js";
import { IdentitySanitizer, type TargetProjectIdentity } from "../core/identitySanitizer.js";
import { FlutterAppAnalyzer, type FlutterAppAnalysis } from "../targets/flutter/flutterAppAnalyzer.js";
import { CONTEXT_MATRIX_CATALOG, getCatalogForArchetype } from "./contextMatrixCatalog.js";

export type EpistemicStatus = "AST_VERIFIED" | "SDK_INFERRED" | "HYPOTHESIS_DRAFT";
export type AppArchetype = "LOCAL_UTILITY" | "CONNECTED_APP" | "B2B_SAAS";

export function inferAppArchetype(signals: ExtractedSignals): AppArchetype {
  const hasBillingSdk = (signals.detectedSdks || []).some(
    (s) => s.category === "billing" || /stripe|billing|revenuecat|iap|in_app_purchase/i.test(s.name)
  );
  const hasAuthSdk = (signals.detectedSdks || []).some(
    (s) => s.category === "auth" || /auth|cognito|supabase/i.test(s.name)
  );
  const hasSaasTable = (signals.sqliteTables || []).some(
    (t) =>
      /tenant|organization|orgs|subscript|team|company|account|workspace|member/i.test(t.name) ||
      (t.columns || []).some((c) => /tenant_id|org_id|company_id|subscription/i.test(c))
  );
  const hasSaasEndpoint = (signals.apiEndpoints || []).some((e) =>
    /billing|charge|subscription|tenant|organization|workspace|invoice/i.test(e.path)
  );

  if ((hasBillingSdk && hasAuthSdk) || hasSaasTable || hasSaasEndpoint) {
    return "B2B_SAAS";
  }

  const hasInternet = (signals.permissions || []).some((p) => p.toLowerCase().includes("internet"));
  const hasEndpoints = (signals.apiEndpoints || []).length > 0;

  if (hasInternet || hasEndpoints) {
    return "CONNECTED_APP";
  }

  return "LOCAL_UTILITY";
}

export interface ExtractedSignals {
  appName: string;
  packageName?: string;
  version?: string;
  permissions: string[];
  activities: string[];
  colors: Record<string, string>;
  sqliteTables: { name: string; columns: string[]; rowCount: number }[];
  apiEndpoints: { method: string; path: string; modelName?: string }[];
  detectedSdks: { name: string; category: "billing" | "ads" | "analytics" | "auth" | "crash"; fileSource: string }[];
  sourceArtifacts: string[];
  flutterAnalysis?: FlutterAppAnalysis;
}

export interface ContextFileSpec {
  relativePath: string;
  title: string;
  pillar: "00_Strategy" | "01_Product" | "02_Creative" | "03_Tech";
  epistemicStatus: EpistemicStatus;
  needsHumanReview: boolean;
  content: string;
}

export interface ContextGeneratorOptions {
  appName?: string;
  allSlots?: boolean;
  profile?: "utility" | "connected" | "saas" | "auto";
  dryRun?: boolean;
  reflutterDumpPath?: string;
  blutterDir?: string;
  flutterAnalysis?: FlutterAppAnalysis;
  scaffoldFiveTierApp?: boolean;
  withDna?: boolean;
}

export interface ContextGenerationResult {
  targetDir: string;
  signals: ExtractedSignals;
  filesWritten: string[];
  filesUpdated: string[];
  filesSkipped: string[];
  dnaStamped?: boolean;
  ecosystemMode?: "agents_synergy" | "standalone";
}

export class ContextGenerator {
  public scanSource(sourcePath: string, options: ContextGeneratorOptions = {}): ExtractedSignals {
    const signals: ExtractedSignals = {
      appName: options.appName || path.basename(path.resolve(sourcePath)),
      permissions: [],
      activities: [],
      colors: {},
      sqliteTables: [],
      apiEndpoints: [],
      detectedSdks: [],
      sourceArtifacts: [],
    };

    if (!fs.existsSync(sourcePath)) {
      return signals;
    }

    const stat = fs.statSync(sourcePath);
    const filesToScan: string[] = [];

    if (stat.isDirectory()) {
      this.collectFilesRecursive(sourcePath, filesToScan, 4);
    } else {
      filesToScan.push(sourcePath);
    }

    for (const file of filesToScan) {
      const lower = file.toLowerCase();
      const base = path.basename(lower);

      if (base === "androidmanifest.xml") {
        signals.sourceArtifacts.push(file);
        try {
          const content = fs.readFileSync(file, "utf8");
          if (content.includes("<manifest")) {
            this.parseManifestXml(content, signals);
          } else {
            const buf = fs.readFileSync(file);
            const parser = new AxmlParser(buf);
            if (parser.isAxml()) {
              const root = parser.parse();
              const parsedXml = parser.toXml(root);
              this.parseManifestXml(parsedXml, signals);
            }
          }
        } catch {
          // Degrade gracefully
        }
      }

      if (base === "colors.xml" || base === "styles.xml") {
        signals.sourceArtifacts.push(file);
        try {
          const content = fs.readFileSync(file, "utf8");
          this.parseColorsXml(content, signals);
        } catch {
          // Degrade gracefully
        }
      }

      if (lower.endsWith(".sqlite") || lower.endsWith(".sqlite3") || lower.endsWith(".db")) {
        signals.sourceArtifacts.push(file);
        let extractedReal = false;
        try {
          const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
          const pyCode = `import sqlite3, json, sys; conn = sqlite3.connect(sys.argv[1]); cur = conn.cursor(); cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"); tables = [r[0] for r in cur.fetchall()]; out = []; [out.append({"name": t, "columns": [c[1] for c in cur.execute(f'PRAGMA table_info("{t}")').fetchall()], "rowCount": cur.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0]}) for t in tables]; print(json.dumps(out))`;
          const proc = spawnSync("python", ["-c", pyCode, file], { encoding: "utf8", timeout: 5000 });
          if (proc.status === 0 && proc.stdout) {
            const parsed = JSON.parse(proc.stdout.trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
              signals.sqliteTables.push(...parsed);
              extractedReal = true;
            }
          }
        } catch {
          // fallback below
        }
        if (!extractedReal) {
          signals.sqliteTables.push({
            name: path.basename(file, path.extname(file)),
            columns: ["id", "data", "created_at"],
            rowCount: 0,
          });
        }
      }

      if (lower.endsWith(".har")) {
        signals.sourceArtifacts.push(file);
        try {
          const content = fs.readFileSync(file, "utf8");
          const res = HarSqliteInspector.parseHar(content);
          for (const ep of res.endpoints) {
            signals.apiEndpoints.push({
              method: ep.method,
              path: ep.path,
              modelName: ep.inferredModelName,
            });
          }
        } catch {
          // Degrade gracefully
        }
      }

      if (base === "build.gradle" || base === "build.gradle.kts" || base === "pubspec.yaml" || base === "package.json") {
        signals.sourceArtifacts.push(file);
        try {
          const content = fs.readFileSync(file, "utf8");
          this.detectSdksInContent(content, file, signals);
        } catch {
          // Degrade gracefully
        }
      }

      if (lower.includes("com/android/billingclient") || lower.includes("com.android.billingclient")) {
        this.addSdkOnce(signals, "Google Play Billing", "billing", file);
      } else if (lower.includes("com/google/android/gms/ads") || lower.includes("com.google.android.gms.ads")) {
        this.addSdkOnce(signals, "Google AdMob", "ads", file);
      } else if (lower.includes("com/google/firebase/auth") || lower.includes("firebase_auth")) {
        this.addSdkOnce(signals, "Firebase Auth", "auth", file);
      } else if (lower.includes("com/google/firebase/analytics") || lower.includes("firebase_analytics")) {
        this.addSdkOnce(signals, "Firebase Analytics", "analytics", file);
      } else if (lower.includes("io/sentry") || lower.includes("sentry_flutter")) {
        this.addSdkOnce(signals, "Sentry Error Monitoring", "crash", file);
      }
    }

    if (options.flutterAnalysis) {
      signals.flutterAnalysis = options.flutterAnalysis;
      this.enrichSignalsFromFlutterAnalysis(signals, options.flutterAnalysis);
    }

    return signals;
  }

  public async scanSourceAsync(sourcePath: string, options: ContextGeneratorOptions = {}): Promise<ExtractedSignals> {
    const signals = this.scanSource(sourcePath, options);

    // Enrich any discovered SQLite database files with real table schemas via HarSqliteInspector
    const dbArtifacts = signals.sourceArtifacts.filter((f) => /\.(sqlite|sqlite3|db)$/i.test(f));
    if (dbArtifacts.length > 0) {
      const realTables: { name: string; columns: string[]; rowCount: number }[] = [];
      for (const dbFile of dbArtifacts) {
        try {
          const dbRes = await HarSqliteInspector.inspectSqlite(dbFile);
          for (const t of dbRes.tables) {
            realTables.push({
              name: t.tableName,
              columns: t.columns.map((c) => c.name),
              rowCount: t.rowCount,
            });
          }
        } catch {
          // keep fallback entry if sqlite3 inspection fails
        }
      }
      if (realTables.length > 0) {
        signals.sqliteTables = realTables;
      }
    }

    if (options.flutterAnalysis) {
      signals.flutterAnalysis = options.flutterAnalysis;
      this.enrichSignalsFromFlutterAnalysis(signals, options.flutterAnalysis);
      return signals;
    }

    const isFlutterTarget = await this.detectFlutterTarget(sourcePath, options);
    if (isFlutterTarget) {
      const analyzer = new FlutterAppAnalyzer();
      const analysis = await analyzer.analyzeTarget(sourcePath, {
        reflutterDumpPath: options.reflutterDumpPath,
        blutterDirPath: options.blutterDir,
      });
      signals.flutterAnalysis = analysis;
      this.enrichSignalsFromFlutterAnalysis(signals, analysis);
    }

    return signals;
  }

  private enrichSignalsFromFlutterAnalysis(signals: ExtractedSignals, analysis: FlutterAppAnalysis): void {
    if (analysis.packageName && (!signals.packageName || signals.packageName === "com.example.app")) {
      signals.packageName = analysis.packageName;
    }
    if (analysis.appName && (!signals.appName || signals.appName === path.basename(signals.appName))) {
      signals.appName = analysis.appName;
    }
    for (const ep of analysis.discoveredEndpoints) {
      signals.apiEndpoints.push({
        method: ep.protocol === "REST" ? "GET" : ep.protocol,
        path: ep.urlOrPath,
      });
    }
    for (const tbl of analysis.discoveredTables) {
      if (!signals.sqliteTables.some((t) => t.name === tbl)) {
        signals.sqliteTables.push({
          name: tbl,
          columns: ["id", "data", "created_at"],
          rowCount: 0,
        });
      }
    }
    for (const pkg of analysis.pubPackages) {
      const cat = pkg.category.toLowerCase();
      let sdkCat: "billing" | "ads" | "analytics" | "auth" | "crash" | null = null;
      if (cat.includes("billing") || cat.includes("purchase")) sdkCat = "billing";
      else if (cat.includes("ad")) sdkCat = "ads";
      else if (cat.includes("analytics")) sdkCat = "analytics";
      else if (cat.includes("auth")) sdkCat = "auth";
      else if (cat.includes("crash") || cat.includes("monitoring")) sdkCat = "crash";

      if (sdkCat) {
        this.addSdkOnce(signals, pkg.name, sdkCat, "flutter_assets/NOTICES.Z");
      }
    }
    if (analysis.aotReport?.filePath) {
      signals.sourceArtifacts.push(analysis.aotReport.filePath);
    }
  }

  private async detectFlutterTarget(sourcePath: string, options: ContextGeneratorOptions): Promise<boolean> {
    if (options.reflutterDumpPath || options.blutterDir) return true;
    if (!fs.existsSync(sourcePath)) return false;
    const lower = sourcePath.toLowerCase();
    if (lower.endsWith(".apk") || lower.endsWith(".ipa") || lower.endsWith(".so")) {
      return true;
    }
    if (fs.statSync(sourcePath).isDirectory()) {
      if (
        fs.existsSync(path.join(sourcePath, "libapp.so")) ||
        fs.existsSync(path.join(sourcePath, "libflutter.so")) ||
        fs.existsSync(path.join(sourcePath, "flutter_assets")) ||
        fs.existsSync(path.join(sourcePath, "pp.txt")) ||
        fs.existsSync(path.join(sourcePath, "dump.dart"))
      ) {
        return true;
      }
    }
    return false;
  }

  public async generateAsync(sourcePath: string, targetContextDir: string, options: ContextGeneratorOptions = {}): Promise<ContextGenerationResult> {
    const signals = await this.scanSourceAsync(sourcePath, options);
    const result: ContextGenerationResult = {
      targetDir: targetContextDir,
      signals,
      filesWritten: [],
      filesUpdated: [],
      filesSkipped: [],
    };

    if (options.dryRun) {
      return result;
    }

    fs.mkdirSync(targetContextDir, { recursive: true });

    const plannedFiles = this.synthesizeContextFiles(signals, options);

    for (const fileSpec of plannedFiles) {
      const fullPath = path.join(targetContextDir, fileSpec.relativePath);
      const fileDir = path.dirname(fullPath);
      fs.mkdirSync(fileDir, { recursive: true });

      const fileWritten = this.writeOrMergeFile(fullPath, fileSpec, signals);
      if (fileWritten === "written") {
        result.filesWritten.push(fileSpec.relativePath);
      } else if (fileWritten === "updated") {
        result.filesUpdated.push(fileSpec.relativePath);
      } else {
        result.filesSkipped.push(fileSpec.relativePath);
      }
    }

    const env = MechanicalGuard.detectEcosystemMode(targetContextDir);
    result.ecosystemMode = env.mode;
    result.dnaStamped = this.generateDnaManifest(targetContextDir, signals, options);
    if (env.mode === "agents_synergy") {
      try {
        const projDir = path.basename(targetContextDir) === "context" ? path.dirname(targetContextDir) : targetContextDir;
        MechanicalGuard.runPostGenerationHandshake(projDir);
      } catch {
        // Graceful fallback: never block context generation on handshake failure
      }
    }
    return result;
  }

  public generate(sourcePath: string, targetContextDir: string, options: ContextGeneratorOptions = {}): ContextGenerationResult {
    const rawSignals = this.scanSource(sourcePath, options);
    const resolvedIdentity = IdentitySanitizer.resolveIdentity({
      userAppName: options.appName,
      sourceArtifactPath: sourcePath,
      detectedSourcePackageId: rawSignals.packageName,
      detectedSourceAppName: rawSignals.appName,
      workspaceDir: path.basename(targetContextDir) === "context" ? path.dirname(targetContextDir) : targetContextDir,
    });
    const signals: ExtractedSignals = {
      ...rawSignals,
      appName: resolvedIdentity.appName,
      packageName: resolvedIdentity.packageId,
    };
    const result: ContextGenerationResult = {
      targetDir: targetContextDir,
      signals,
      filesWritten: [],
      filesUpdated: [],
      filesSkipped: [],
    };

    if (options.dryRun) {
      return result;
    }

    fs.mkdirSync(targetContextDir, { recursive: true });

    const plannedFiles = this.synthesizeContextFiles(signals, options);

    for (const fileSpec of plannedFiles) {
      const fullPath = path.join(targetContextDir, fileSpec.relativePath);
      const fileDir = path.dirname(fullPath);
      fs.mkdirSync(fileDir, { recursive: true });

      const fileWritten = this.writeOrMergeFile(fullPath, fileSpec, signals);
      if (fileWritten === "written") {
        result.filesWritten.push(fileSpec.relativePath);
      } else if (fileWritten === "updated") {
        result.filesUpdated.push(fileSpec.relativePath);
      } else {
        result.filesSkipped.push(fileSpec.relativePath);
      }
    }

    const env = MechanicalGuard.detectEcosystemMode(targetContextDir);
    result.ecosystemMode = env.mode;
    result.dnaStamped = this.generateDnaManifest(targetContextDir, signals, options);
    if (env.mode === "agents_synergy") {
      try {
        const projDir = path.basename(targetContextDir) === "context" ? path.dirname(targetContextDir) : targetContextDir;
        MechanicalGuard.runPostGenerationHandshake(projDir);
      } catch {
        // Graceful fallback: never block context generation on handshake failure
      }
    }
    return result;
  }

  public generateDnaManifest(targetContextDir: string, signals: ExtractedSignals, options: ContextGeneratorOptions = {}): boolean {
    try {
      const projectRoot = path.basename(targetContextDir) === "context"
        ? path.dirname(targetContextDir)
        : targetContextDir;

      if (options.scaffoldFiveTierApp) {
        const fiveTiers = [
          "lib/contracts",
          "lib/domain",
          "lib/services",
          "lib/state",
          "lib/presentation/screens",
        ];
        for (const relDir of fiveTiers) {
          fs.mkdirSync(path.join(projectRoot, relDir), { recursive: true });
        }
      }

      const env = MechanicalGuard.detectEcosystemMode(projectRoot);
      if (env.mode !== "agents_synergy" && options.withDna !== true) {
        return false; // Skip creating phantom .agents folder in standalone mode
      }

      const agentsDir = path.join(projectRoot, ".agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      const dnaPath = path.join(agentsDir, ".dna.json");

      let existingDna: any = {};
      if (fs.existsSync(dnaPath)) {
        try {
          existingDna = JSON.parse(fs.readFileSync(dnaPath, "utf8"));
        } catch {
          // ignore
        }
      }

      const appName = signals.appName || (signals.flutterAnalysis?.appName) || "Flutter Reverse Workspace";

      const canonicalAliases: Record<string, string> = {
        "lib/core/models": "1_contracts",


        "lib/features/*/domain/models": "1_contracts",
        "lib/features/*/domain": "2_domain",
        "lib/features/*/data": "3_services",
        "lib/core/bridge": "3_services",
        "lib/features/*/presentation/controllers": "4_state",
        "lib/features/*/presentation/state": "4_state",
        "lib/features/*/presentation/screens": "5_presentation",
        "lib/features/*/presentation/widgets": "5_presentation",
        "lib/presentation/screens": "5_presentation",
        "lib/presentation": "5_presentation",
        "lib/ui/screens": "5_presentation",
        "lib/core/l10n": "1_contracts",
        "lib/l10n": "1_contracts",


        "lib/contracts": "1_contracts",
        "lib/models": "1_contracts",
        "lib/domain": "2_domain",
        "lib/services": "3_services",
        "lib/data/datasources": "3_services",
        "lib/state": "4_state",
        "lib/providers": "4_state",
        "lib/blocs": "4_state",
        "lib/controllers": "4_state",
      };

      const dnaManifest = {
        ...existingDna,
        schema_version: "0.0.1",
        origin: "flutterin",
        dna_state: existingDna.dna_state || "BORN_FROM_REVERSE",
        archetype: `Flutter Application (${appName})`,
        ecosystem: "flutter",
        framework: "flutter",
        language: "dart",
        primary_framework: "flutter",
        primary_language: "dart",
        stacks: ["Flutter/Dart"],
        verified_gates: "5-Tier Architectural Stratification | Clean Contract Separation | Universal Living DNA",
        invariants: [
          "Generated/Assimilated via flutterin context synthesis pipeline",
          "Adheres to 5-Tier architectural stratification (contracts, domain, services, state, presentation)",
          "Clean separation between reverse-engineered assets and business domain"
        ],
        epigenetic_aliases: canonicalAliases,
        mutation_ledger: {
          ...(existingDna.mutation_ledger || {}),
          dna_compliance_score: existingDna.dna_compliance_score ?? 100,
          epigenetic_aliases: canonicalAliases,
          layer_violations: existingDna.layer_violations || [],
          chimera_files: existingDna.chimera_files || [],
        },
      };

      fs.writeFileSync(dnaPath, JSON.stringify(dnaManifest, null, 2), "utf8");
      return true;
    } catch {
      return false;
    }
  }

  public synthesizeContextFiles(signals: ExtractedSignals, options: ContextGeneratorOptions): ContextFileSpec[] {
    const specs: ContextFileSpec[] = [];

    if (options.allSlots === true || (options.allSlots === undefined && signals.flutterAnalysis)) {
      const hasRealSignal = Boolean(
        signals.flutterAnalysis?.isFlutterApp ||
        signals.sourceArtifacts.length > 0 ||
        signals.permissions.length > 0 ||
        signals.apiEndpoints.length > 0 ||
        signals.sqliteTables.length > 0
      );
      for (const entry of CONTEXT_MATRIX_CATALOG) {
        const rawSpec: ContextFileSpec = {
          relativePath: entry.relativePath,
          title: entry.title,
          pillar: entry.pillar,
          epistemicStatus: entry.defaultEpistemicStatus,
          needsHumanReview: entry.needsHumanReview,
          content: entry.synthesize(signals.flutterAnalysis, signals),
        };
        specs.push(MechanicalGuard.guardEpistemicTruth(rawSpec, hasRealSignal, entry.relativePath));
      }
      return specs;
    }

    specs.push({
      relativePath: "00_Strategy/BLUEPRINT.md",
      title: "Executive Strategy Blueprint",
      pillar: "00_Strategy",
      epistemicStatus: signals.packageName ? "SDK_INFERRED" : "HYPOTHESIS_DRAFT",
      needsHumanReview: true,
      content: this.generateBlueprintContent(signals),
    });

    specs.push({
      relativePath: "01_Product/ROADMAP.md",
      title: "Product Roadmap & Feature Scope",
      pillar: "01_Product",
      epistemicStatus: "HYPOTHESIS_DRAFT",
      needsHumanReview: true,
      content: this.generateRoadmapContent(signals),
    });

    specs.push({
      relativePath: "02_Creative/STYLE_GUIDE.md",
      title: "Creative Style Guide & UI Design Tokens",
      pillar: "02_Creative",
      epistemicStatus: Object.keys(signals.colors).length > 0 ? "AST_VERIFIED" : "HYPOTHESIS_DRAFT",
      needsHumanReview: false,
      content: this.generateStyleGuideContent(signals),
    });

    specs.push({
      relativePath: "03_Tech/ARCHITECTURE.md",
      title: "Technical Architecture & System Blueprint",
      pillar: "03_Tech",
      epistemicStatus: "AST_VERIFIED",
      needsHumanReview: false,
      content: this.generateArchitectureContent(signals),
    });

    if (signals.permissions.length > 0 || options.allSlots) {
      specs.push({
        relativePath: "03_Tech/Infra_Security.md",
        title: "Infrastructure & Security Specifications",
        pillar: "03_Tech",
        epistemicStatus: "AST_VERIFIED",
        needsHumanReview: false,
        content: this.generateSecurityContent(signals),
      });
    }

    if (signals.sqliteTables.length > 0 || options.allSlots) {
      const isVerified = signals.sqliteTables.length > 0 && !signals.sqliteTables.every(t => t.columns.join(",") === "id,data,created_at");
      specs.push({
        relativePath: "03_Tech/Dev_Database.md",
        title: "Database Schemas & Data Storage Models",
        pillar: "03_Tech",
        epistemicStatus: isVerified ? "AST_VERIFIED" : "HYPOTHESIS_DRAFT",
        needsHumanReview: !isVerified,
        content: this.generateDatabaseContent(signals),
      });
    }

    if (signals.apiEndpoints.length > 0 || options.allSlots) {
      const isVerified = signals.apiEndpoints.length > 0;
      specs.push({
        relativePath: "03_Tech/Dev_APIs.md",
        title: "API Endpoint Contracts & Interfaces",
        pillar: "03_Tech",
        epistemicStatus: isVerified ? "AST_VERIFIED" : "HYPOTHESIS_DRAFT",
        needsHumanReview: !isVerified,
        content: this.generateApiContent(signals),
      });
    }

    if (Object.keys(signals.colors).length > 0 || options.allSlots) {
      specs.push({
        relativePath: "02_Creative/Design_Design_System.md",
        title: "Design System & Theme Tokens",
        pillar: "02_Creative",
        epistemicStatus: "AST_VERIFIED",
        needsHumanReview: false,
        content: this.generateDesignSystemContent(signals),
      });
    }

    if (signals.activities.length > 0 || options.allSlots) {
      specs.push({
        relativePath: "02_Creative/Design_UX_Flows.md",
        title: "UX Navigation Flows & Screen Hierarchy",
        pillar: "02_Creative",
        epistemicStatus: "AST_VERIFIED",
        needsHumanReview: false,
        content: this.generateUxFlowsContent(signals),
      });
    }

    const billingSdk = signals.detectedSdks.find((s) => s.category === "billing");
    if (billingSdk || options.allSlots) {
      specs.push({
        relativePath: "01_Product/Conv_Pricing_Strategy.md",
        title: "Revenue Models & In-App Purchase Specifications",
        pillar: "01_Product",
        epistemicStatus: "SDK_INFERRED",
        needsHumanReview: true,
        content: this.generatePricingContent(signals, billingSdk),
      });
    }

    const analyticsSdk = signals.detectedSdks.find((s) => s.category === "analytics");
    if (analyticsSdk || options.allSlots) {
      specs.push({
        relativePath: "01_Product/Data_User_Tracking.md",
        title: "User Tracking & Telemetry Analytics",
        pillar: "01_Product",
        epistemicStatus: "SDK_INFERRED",
        needsHumanReview: true,
        content: this.generateAnalyticsContent(signals, analyticsSdk),
      });
    }

    const authSdk = signals.detectedSdks.find((s) => s.category === "auth");
    if (authSdk || options.allSlots) {
      specs.push({
        relativePath: "03_Tech/Dev_Authentication.md",
        title: "Authentication & Identity Management",
        pillar: "03_Tech",
        epistemicStatus: "SDK_INFERRED",
        needsHumanReview: true,
        content: this.generateAuthContent(signals, authSdk),
      });
    }

    return specs;
  }

  public writeOrMergeFile(filePath: string, spec: ContextFileSpec, signals: ExtractedSignals): "written" | "updated" | "skipped" {
    const sources = signals.sourceArtifacts.map((s) => path.basename(s)).filter((v, i, a) => a.indexOf(v) === i);
    const sourcesStr = sources.length > 0 ? sources.join(", ") : "inferred-code-signals";

    const anchorStart = `<!-- [FLUTTERIN:AUTO-INFERRED:START source="${sourcesStr}" confidence="${spec.epistemicStatus}"] -->`;
    const anchorEnd = `<!-- [FLUTTERIN:AUTO-INFERRED:END] -->`;
    const boundedChunk = `${anchorStart}\n${spec.content.trim()}\n${anchorEnd}`;

    const frontmatter = [
      "---",
      `title: "${spec.title}"`,
      `epistemic_status: ${spec.epistemicStatus}`,
      `source_artifacts: [${sources.map((s) => `"${s}"`).join(", ")}]`,
      `needs_human_review: ${spec.needsHumanReview}`,
      `last_scanned: ${new Date().toISOString()}`,
      "---",
    ].join("\n");

    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, "utf8");
      const anchorRegex = /<!-- \[(?:FLUTTERIN|ORION):AUTO-INFERRED:START.*?-->[\s\S]*?<!-- \[(?:FLUTTERIN|ORION):AUTO-INFERRED:END\] -->/;

      if (anchorRegex.test(existing)) {
        // Safe string replacement without $ pattern corruption
        const updated = existing.replace(anchorRegex, () => boundedChunk);
        fs.writeFileSync(filePath, updated, "utf8");
        return "updated";
      } else {
        const updated = `${existing.trim()}\n\n## Auto-Extracted Specifications\n\n${boundedChunk}\n`;
        fs.writeFileSync(filePath, updated, "utf8");
        return "updated";
      }
    }

    const disclaimer = spec.epistemicStatus === "HYPOTHESIS_DRAFT"
      ? `> [!WARNING] UNVERIFIED HYPOTHESIS DRAFT\n> This specification was inferred from codebase heuristics and requires human business validation.\n\n`
      : "";

    const fullContent = `${frontmatter}\n\n# ${spec.title}\n\n${disclaimer}${boundedChunk}\n\n<!-- Manual developer notes outside comment anchors are 100% PRESERVED across re-scans -->\n## Manual Architecture & Business Decisions\n- (Add custom domain notes here)\n`;

    fs.writeFileSync(filePath, fullContent, "utf8");
    return "written";
  }

  private generateBlueprintContent(signals: ExtractedSignals): string {
    const env = MechanicalGuard.detectEcosystemMode(process.cwd());
    const ecosystemDesc = env.mode === "agents_synergy"
      ? "Managed by `.agents` Portable Brainvibing and reverse engineered via `flutterin`."
      : "Standalone Flutter 3 / Dart 3 workspace reverse-engineered via `flutterin` (zero external agent framework coupling).";

    return `## Executive Overview
- **Application Name**: \`${signals.appName}\`
${signals.packageName ? `- **Target Package ID**: \`${signals.packageName}\`` : ""}
${signals.version ? `- **Version**: \`${signals.version}\`` : ""}

### Strategic Alignment
- **Porting Objective**: Transform extracted Android/Web architecture into clean, idiomatic Flutter 3 / Dart 3.
- **Ecosystem**: ${ecosystemDesc}`;
  }

  private generateRoadmapContent(signals: ExtractedSignals): string {
    return `## Phased Flutter 3 Migration Pipeline
- [ ] **Phase 1: Data Models (\`lib/models/\`)**: ${signals.sqliteTables.length > 0 ? `Materialize ${signals.sqliteTables.length} SQLite schemas into Drift/Dart models.` : "Materialize core JSON DTOs."}
- [ ] **Phase 2: Services & API (\`lib/services/\`)**: ${signals.apiEndpoints.length > 0 ? `Configure Dio service contracts for ${signals.apiEndpoints.length} endpoints.` : "Setup networking client."}
- [ ] **Phase 3: Design Tokens (\`lib/theme/\`)**: ${Object.keys(signals.colors).length > 0 ? `Apply ${Object.keys(signals.colors).length} theme tokens to Material 3 ThemeData.` : "Configure baseline theme."}
- [ ] **Phase 4: UI Screens (\`lib/screens/\`)**: ${signals.activities.length > 0 ? `Port ${signals.activities.length} primary activity screens to Flutter widgets.` : "Port layout widgets."}
- [ ] **Phase 5: Routing & Navigation (\`lib/router/\`)**: Orchestrate screen navigation via GoRouter.`;
  }

  private generateStyleGuideContent(signals: ExtractedSignals): string {
    const colorLines = Object.entries(signals.colors)
      .slice(0, 20)
      .map(([name, hex]) => `- \`${name}\`: \`${hex}\``)
      .join("\n");

    return `## Visual Craft & Design Tokens
${colorLines ? `### Extracted Theme Colors\n${colorLines}` : "- *No external color resources detected; adopting standard Material 3 dynamic color scheme.*"}

### Flutter 3 Styling Directives
- Use \`Theme.of(context).colorScheme\` for semantic color assignment.
- Strictly adhere to 8pt spatial grid tokens for padding and margins.`;
  }

  private generateArchitectureContent(signals: ExtractedSignals): string {
    return `## System Blueprint & Technical Baseline
- **Target Framework**: Flutter 3 / Dart 3 (Idiomatic Unidirectional Data Flow)
- **Detected Capabilities**:
${signals.permissions.slice(0, 10).map((p) => `  - \`${p}\``).join("\n") || "  - Standard application sandbox"}
- **Detected Third-Party Integrations**:
${signals.detectedSdks.map((s) => `  - **${s.name}** (\`${s.category}\`)`).join("\n") || "  - Zero external SDKs detected"}`;
  }

  private generateSecurityContent(signals: ExtractedSignals): string {
    return `## Declared Application Permissions & Sandbox Capabilities
| Permission Identifier | Security Level | Classification |
| :--- | :--- | :--- |
${signals.permissions.map((p) => `| \`${p}\` | System Sandbox | AST_VERIFIED |`).join("\n")}`;
  }

  private generateDatabaseContent(signals: ExtractedSignals): string {
    return `## Persistent Storage & Database Schemas
${signals.sqliteTables.map((t) => `### Table: \`${t.name}\`\n- **Columns**: ${t.columns.map((c) => `\`${c}\``).join(", ")}\n- **Sample Row Count**: ${t.rowCount}`).join("\n\n")}`;
  }

  private generateApiContent(signals: ExtractedSignals): string {
    return `## Inspected Network Endpoints
| HTTP Method | Route Path | Inferred Model |
| :--- | :--- | :--- |
${signals.apiEndpoints.slice(0, 25).map((e) => `| \`${e.method}\` | \`${e.path}\` | \`${e.modelName || "Map<String, dynamic>"}\` |`).join("\n")}`;
  }

  private generateDesignSystemContent(signals: ExtractedSignals): string {
    return `## Palette & Token Catalog
\`\`\`dart
// Autogenerated ColorScheme mappings
${Object.entries(signals.colors).slice(0, 20).map(([k, v]) => `static const Color ${k.replace(/[^a-zA-Z0-9_]/g, "_")} = Color(${v.startsWith("#") ? "0xFF" + v.replace("#", "") : v});`).join("\n")}
\`\`\``;
  }

  private generateUxFlowsContent(signals: ExtractedSignals): string {
    return `## Screen Hierarchy & Navigation Graph
${signals.activities.map((a, i) => `${i + 1}. **${a}** (\`/screen_${a.toLowerCase().replace(/activity$/, "")}\`)`).join("\n")}`;
  }

  private generatePricingContent(signals: ExtractedSignals, sdk?: { name: string }): string {
    return `## Monetization Architecture
- **In-App Billing Provider**: ${sdk ? sdk.name : "Unspecified"}
- **Verification Status**: \`[SDK_INFERRED]\` - Product tiers, subscriptions, and SKU identifiers must be verified with store console.`;
  }

  private generateAnalyticsContent(signals: ExtractedSignals, sdk?: { name: string }): string {
    return `## Telemetry & User Event Tracking
- **Analytics Provider**: ${sdk ? sdk.name : "Unspecified"}
- **Directives**: Wrap analytics calls in unified telemetry abstraction; prevent unconsented tracking.`;
  }

  private generateAuthContent(signals: ExtractedSignals, sdk?: { name: string }): string {
    return `## Identity & Session Management
- **Auth Provider**: ${sdk ? sdk.name : "Custom / Unspecified"}
- **State Security**: Store session tokens in \`flutter_secure_storage\` / EncryptedSharedPreferences.`;
  }

  private parseManifestXml(xml: string, signals: ExtractedSignals): void {
    const pkgMatch = xml.match(/package=["']([^"']+)["']/);
    if (pkgMatch && !signals.packageName) signals.packageName = pkgMatch[1];

    const verMatch = xml.match(/android:versionName=["']([^"']+)["']/);
    if (verMatch && !signals.version) signals.version = verMatch[1];

    const permMatches = xml.matchAll(/<uses-permission[^>]+android:name=["']([^"']+)["']/g);
    for (const m of permMatches) {
      if (!signals.permissions.includes(m[1])) signals.permissions.push(m[1]);
    }

    const actMatches = xml.matchAll(/<activity[^>]+android:name=["']([^"']+)["']/g);
    for (const m of actMatches) {
      const name = m[1].split(".").pop() || m[1];
      if (!signals.activities.includes(name)) signals.activities.push(name);
    }
  }

  private parseColorsXml(xml: string, signals: ExtractedSignals): void {
    const colorMatches = xml.matchAll(/<color\s+name=["']([^"']+)["']>([^<]+)<\/color>/g);
    for (const m of colorMatches) {
      signals.colors[m[1]] = m[2].trim();
    }
  }

  private detectSdksInContent(content: string, filePath: string, signals: ExtractedSignals): void {
    const lower = content.toLowerCase();
    if (lower.includes("billingclient") || lower.includes("in_app_purchase") || lower.includes("stripe")) {
      this.addSdkOnce(signals, "In-App Billing / Payments", "billing", filePath);
    }
    if (lower.includes("play-services-ads") || lower.includes("google_mobile_ads") || lower.includes("applovin")) {
      this.addSdkOnce(signals, "Mobile Ad Network", "ads", filePath);
    }
    if (lower.includes("firebase_auth") || lower.includes("firebase-auth") || lower.includes("supabase")) {
      this.addSdkOnce(signals, "Authentication Service", "auth", filePath);
    }
    if (lower.includes("firebase_analytics") || lower.includes("posthog") || lower.includes("mixpanel")) {
      this.addSdkOnce(signals, "Analytics Telemetry", "analytics", filePath);
    }
    if (lower.includes("sentry")) {
      this.addSdkOnce(signals, "Sentry Error Monitoring", "crash", filePath);
    }
  }

  private addSdkOnce(signals: ExtractedSignals, name: string, category: "billing" | "ads" | "analytics" | "auth" | "crash", fileSource: string): void {
    if (!signals.detectedSdks.some((s) => s.name === name)) {
      signals.detectedSdks.push({ name, category, fileSource });
    }
  }

  private collectFilesRecursive(dir: string, fileList: string[], maxDepth: number, currentDepth: number = 0): void {
    if (currentDepth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
            this.collectFilesRecursive(full, fileList, maxDepth, currentDepth + 1);
          }
        } else {
          fileList.push(full);
        }
      }
    } catch {
      // ignore
    }
  }
}
