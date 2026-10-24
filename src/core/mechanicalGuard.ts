import * as fs from "node:fs";
import * as path from "node:path";

export interface EcosystemEnvironment {
  mode: "agents_synergy" | "standalone";
  agentsRoot?: string;
  hasOrionScript: boolean;
  hasContextDir: boolean;
  hasOfficialFlutterPlugin: boolean;
}

/**
 * Universal Mechanical Catch & Contract Invariant Guard for flutterin.
 * Prevents infinite loops, silent semantic lies, and unhandled binary parser traps.
 */
export class MechanicalGuard {
  /**
   * Detects whether flutterin is executing inside a full .agents (Portable-Brainvibing)
   * workspace or running in Standalone Mode.
   * Walks up to 4 directory levels from startDir searching for genuine .agents infrastructure
   * (.agents/scripts/orion.py or .agents/AGENTS_INDEX.md).
   */
  public static detectEcosystemMode(startDir?: string): EcosystemEnvironment {
    if (process.env.FLUTTERIN_STANDALONE === "1" || process.env.FLUTTERIN_STANDALONE === "true") {
      return {
        mode: "standalone",
        hasOrionScript: false,
        hasContextDir: false,
        hasOfficialFlutterPlugin: this.checkOfficialFlutterPlugin(),
      };
    }

    let current = path.resolve(startDir || process.cwd());
    const root = path.parse(current).root;

    for (let i = 0; i < 5; i++) {
      const candidateAgents = path.join(current, ".agents");
      if (fs.existsSync(candidateAgents)) {
        // Distinguish genuine .agents workspace from a phantom folder containing only .dna.json
        const hasOrion = fs.existsSync(path.join(candidateAgents, "scripts", "orion.py"));
        const hasIndex = fs.existsSync(path.join(candidateAgents, "AGENTS_INDEX.md"));
        const hasPillars = fs.existsSync(path.join(candidateAgents, "skills"));

        if (hasOrion || hasIndex || hasPillars) {
          return {
            mode: "agents_synergy",
            agentsRoot: candidateAgents,
            hasOrionScript: hasOrion,
            hasContextDir: fs.existsSync(path.join(current, "context")),
            hasOfficialFlutterPlugin: this.checkOfficialFlutterPlugin(),
          };
        }
      }

      if (current === root) break;
      current = path.dirname(current);
    }

    return {
      mode: "standalone",
      hasOrionScript: false,
      hasContextDir: fs.existsSync(path.join(startDir || process.cwd(), "context")),
      hasOfficialFlutterPlugin: this.checkOfficialFlutterPlugin(),
    };
  }

  private static checkOfficialFlutterPlugin(): boolean {
    try {
      const homeDir = process.env.USERPROFILE || process.env.HOME || "";
      const flutterPluginDir = path.join(homeDir, ".gemini", "config", "plugins", "flutter");
      return fs.existsSync(flutterPluginDir);
    } catch {
      return false;
    }
  }

  /**
   * Asserts cursor progression for binary/stream readers (WASM, AXML, ASAR).
   * Throws if cursor regresses or fails to advance.
   */
  public static assertCursorProgress(prevPos: number, nextPos: number, maxLen: number, context: string): void {
    if (!Number.isFinite(nextPos) || nextPos <= prevPos || nextPos > maxLen) {
      throw new Error(`[MECHANICAL_LOOP_TRAP:${context}] Invalid cursor progression: ${prevPos} -> ${nextPos} (max: ${maxLen})`);
    }
  }

  /**
   * Guards against Epistemic Poisoning before writing context specs.
   * Automatically downgrades fake/dummy data or fallback boilerplate to HYPOTHESIS_DRAFT.
   */
  public static guardEpistemicTruth<T extends { epistemicStatus: string; needsHumanReview: boolean; content?: string }>(
    spec: T,
    hasRealSignal: boolean,
    context: string,
    signals?: any
  ): T {
    const content = spec.content || "";
    const hasFallbackText =
      content.includes("Standard Flutter core dependencies") ||
      content.includes("GET /api/v1/health") ||
      content.includes("app_cache") ||
      (content.includes("HomeScreen") && content.includes("DetailScreen"));

    let lacksEvidence = false;
    if (signals) {
      const pubPackages = new Set<string>(
        (signals.flutterAnalysis?.pubPackages || []).map((p: any) => (p.name || "").toLowerCase())
      );
      for (const sdk of (signals.detectedSdks || [])) {
        if (sdk.name) pubPackages.add(sdk.name.toLowerCase());
      }

      // Check unverified package claims in content
      if (content.includes("FlutterSecureStorage") || content.includes("flutter_secure_storage")) {
        if (!pubPackages.has("flutter_secure_storage")) lacksEvidence = true;
      }
      if (content.includes("Mockito") || content.includes("Mocktail") || content.includes("mockito") || content.includes("mocktail")) {
        if (!pubPackages.has("mockito") && !pubPackages.has("mocktail")) lacksEvidence = true;
      }
      if (content.includes("integration_test")) {
        if (!pubPackages.has("integration_test")) lacksEvidence = true;
      }
      if (content.includes("Firebase Crashlytics") || content.includes("Sentry")) {
        if (!pubPackages.has("firebase_crashlytics") && !pubPackages.has("sentry_flutter") && !pubPackages.has("sentry")) {
          lacksEvidence = true;
        }
      }
    }

    if ((spec.epistemicStatus === "AST_VERIFIED" || spec.epistemicStatus === "SDK_INFERRED") && (!hasRealSignal || hasFallbackText || lacksEvidence)) {
      return {
        ...spec,
        epistemicStatus: "HYPOTHESIS_DRAFT",
        needsHumanReview: true,
      };
    }
    return spec;
  }

  /**
   * Post-generation auto-verify handshake between flutterin and .agents ecosystem.
   * Runs orion.py dna on the target project to verify 5-Tier layer compliance.
   */
  public static runPostGenerationHandshake(targetDir: string): boolean {
    const env = this.detectEcosystemMode(targetDir);
    if (env.mode !== "agents_synergy" || !env.agentsRoot) return false;
    try {
      const orionPy = path.join(env.agentsRoot, "scripts", "orion.py");
      if (!fs.existsSync(orionPy)) return false;
      const { spawnSync } = require("node:child_process");
      const res = spawnSync("python", [orionPy, "dna", "--target", targetDir], {
        stdio: "pipe",
        encoding: "utf8",
        timeout: 15000,
      });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Universal Try-Catch + Self-Healing Wrapper for decoders and converters.
   */
  public static executeWithFallback<T>(
    context: string,
    fn: () => T,
    fallback: T,
    invariantCheck?: (res: T) => boolean
  ): T {
    try {
      const res = fn();
      if (invariantCheck && !invariantCheck(res)) {
        throw new Error(`[INVARIANT_FAILED:${context}] Output failed mechanical post-condition.`);
      }
      return res;
    } catch (err: any) {
      if (process.env.ORION_DEBUG) {
        process.stderr.write(`[FLUTTERIN_MECHANICAL_CATCH] ${context}: ${err?.message || String(err)}\n`);
      }
      return fallback;
    }
  }
}
