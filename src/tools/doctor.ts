import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import {
  type FlutterinProfile,
  KNOWN_TOOLS,
  PROFILE_DEFINITIONS,
} from "./profiles.js";
import { MechanicalGuard } from "../core/mechanicalGuard.js";

const execAsync = promisify(exec);

export interface ToolCheckResult {
  pillar: string;
  tool: string;
  installed: boolean;
  version?: string;
  description: string;
  status: "ready" | "optional_missing" | "core_missing";
}

export interface DoctorReport {
  timestamp: string;
  activeProfile?: FlutterinProfile;
  profileName?: string;
  pillars: Record<string, ToolCheckResult[]>;
  ecosystemSynergy: {
    officialFlutterPlugin: boolean;
    agentsWorkspace: boolean;
    builtInBinaryDecoders: boolean;
  };
  overallStatus: "healthy" | "partially_equipped" | "action_needed";
}

export class FlutterinDoctor {
  private static readonly PILLAR_TOOLS = [
    // Core Flutter
    { pillar: "Core Flutter", id: "flutter", name: "flutter", cmd: "flutter --version", altCmd: null, desc: "Flutter SDK", required: false },
    { pillar: "Core Flutter", id: "dart", name: "dart", cmd: "dart --version", altCmd: null, desc: "Dart SDK", required: false },

    // Pillar 1: Floor
    { pillar: "Pillar 1 (Floor)", id: "python", name: "python", cmd: "python --version", altCmd: "python3 --version", desc: "Python 3.10+ Stdlib & SQLite3", required: true },

    // Pillar 2: CLI Proxy
    { pillar: "Pillar 2 (CLI)", id: "rtk", name: "rtk", cmd: "rtk --version", altCmd: null, desc: "Rust Token Killer CLI proxy", required: false },

    // Pillar 3: JS/TS Runtime
    { pillar: "Pillar 3 (JS/TS)", id: "node", name: "node", cmd: "node --version", altCmd: null, desc: "Node.js LTS runtime (Pure TS Decoders)", required: true },

    // Pillar 4: Mobile & Bytecode
    { pillar: "Pillar 4 (Mobile)", id: "java", name: "java", cmd: "java -version", altCmd: null, desc: "Java Runtime Environment (JDK 17+)", required: true },
    { pillar: "Pillar 4 (Mobile)", id: "jadx", name: "jadx", cmd: "jadx --version", altCmd: null, desc: "Headless DEX-to-Java/Kotlin decompiler", required: true },
    { pillar: "Pillar 4 (Mobile)", id: "apktool", name: "apktool", cmd: "apktool -version", altCmd: null, desc: "Android resources.arsc decoder", required: false },
    { pillar: "Pillar 4 (Mobile)", id: "adb", name: "adb", cmd: "adb --version", altCmd: null, desc: "Android Debug Bridge for live UI inspection", required: false },

    // Pillar 5: Native Binary
    { pillar: "Pillar 5 (Native)", id: "rizin", name: "rizin", cmd: "rz-bin -v", altCmd: null, desc: "Rizin native binary disassembler", required: true },
    { pillar: "Pillar 5 (Native)", id: "wabt", name: "wabt", cmd: "wasm2wat --version", altCmd: null, desc: "WABT WebAssembly-to-WAT decompiler", required: false },
  ];

  public async checkAll(profile?: FlutterinProfile): Promise<DoctorReport> {
    const pillars: Record<string, ToolCheckResult[]> = {};

    let targetTools = FlutterinDoctor.PILLAR_TOOLS;
    let profileDef = undefined;

    if (profile && PROFILE_DEFINITIONS[profile]) {
      profileDef = PROFILE_DEFINITIONS[profile];
      targetTools = targetTools.filter((t) => profileDef!.toolIds.includes(t.id));
    }

    for (const tool of targetTools) {
      if (!pillars[tool.pillar]) {
        pillars[tool.pillar] = [];
      }

      let installed = false;
      let version: string | undefined;

      try {
        const { stdout, stderr } = await execAsync(tool.cmd, { timeout: 3500 });
        const output = (stdout || stderr).trim().split(/[\r\n]+/)[0];
        if (!output.includes("Microsoft Store") && !output.includes("Python was not found")) {
          installed = true;
          version = output;
        }
      } catch {
        installed = false;
      }

      if (!installed && tool.altCmd) {
        try {
          const { stdout, stderr } = await execAsync(tool.altCmd, { timeout: 3500 });
          const output = (stdout || stderr).trim().split(/[\r\n]+/)[0];
          if (!output.includes("Microsoft Store") && !output.includes("Python was not found")) {
            installed = true;
            version = output;
          }
        } catch {
          installed = false;
        }
      }

      const isRequired = profile ? KNOWN_TOOLS[tool.id]?.required ?? tool.required : (tool.id === "node" || tool.id === "python");

      const status = installed
        ? "ready"
        : isRequired
        ? "core_missing"
        : "optional_missing";

      pillars[tool.pillar].push({
        pillar: tool.pillar,
        tool: tool.name,
        installed,
        version,
        description: tool.desc,
        status,
      });
    }

    const env = MechanicalGuard.detectEcosystemMode(process.cwd());
    const officialFlutterPlugin = env.hasOfficialFlutterPlugin;
    const agentsWorkspace = env.mode === "agents_synergy";

    const hasCoreMissing = Object.values(pillars)
      .flat()
      .some((t) => t.status === "core_missing");

    return {
      timestamp: new Date().toISOString(),
      activeProfile: profile,
      profileName: profileDef?.name,
      pillars,
      ecosystemSynergy: {
        officialFlutterPlugin,
        agentsWorkspace,
        builtInBinaryDecoders: true,
      },
      overallStatus: hasCoreMissing ? "action_needed" : "healthy",
    };
  }
}
