import { Command } from "commander";
import chalk from "chalk";
import { readFile, writeFile } from "node:fs/promises";
import * as fs from "node:fs";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as readline from "node:readline";

const execAsync = promisify(exec);

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
import { AndroidLayoutConverter } from "../targets/android/layoutConverter.js";
import { HtmlTailwindConverter } from "../targets/web/htmlTailwindConverter.js";
import { ReactNativeConverter } from "../targets/react/reactNativeConverter.js";
import { SwiftUiConverter } from "../targets/ios/swiftUiConverter.js";
import { JsonModelConverter } from "../targets/api/jsonModelConverter.js";
import { AotSnapshotReader } from "../targets/binary/aotSnapshotReader.js";
import { SslBypassGenerator } from "../targets/network/sslBypassGenerator.js";
import { FlutterCodeGenerator } from "../generators/flutterCodeGenerator.js";
import { FlutterinDoctor } from "../tools/doctor.js";
import { FlutterinSetup } from "../tools/setup.js";
import { PROFILE_DEFINITIONS, type FlutterinProfile } from "../tools/profiles.js";
import { MobilePackageDecompiler } from "../core/decoders/mobilePackageDecompiler.js";
import { AndroidDecompilerBridge } from "../core/bridges/androidDecompilerBridge.js";
import { AsarUnpacker } from "../core/decoders/asarUnpacker.js";
import { SourceMapReconstructor } from "../core/decoders/sourceMapReconstructor.js";
import { HarSqliteInspector } from "../core/decoders/harSqliteInspector.js";
import { ContextGenerator } from "../generators/contextGenerator.js";
import { IdentitySanitizer } from "../core/identitySanitizer.js";
import { MechanicalGuard } from "../core/mechanicalGuard.js";
import {
  summarizeConversion,
  formatFeasibilityHeader,
  type ConversionFeasibilitySummary,
} from "../ir/feasibility.js";

function renderTierSummary(summary: ConversionFeasibilitySummary, screenName: string): void {
  const t = summary.tierCounts;
  const isInteractive = summary.executionMode === "INTERACTIVE_ESCALATION_REQUIRED";

  console.log("\n" + chalk.bold.cyan("┌────────────────────────────────────────────────────────┐"));
  console.log(chalk.bold.cyan("│  Flutterin 4-Tier Conversion Feasibility Report        │"));
  console.log(chalk.bold.cyan("├────────────────────────────────────────────────────────┤"));
  console.log(`│  Target Screen: ${chalk.bold(screenName.padEnd(38))} │`);
  console.log(`│  • Tier 1 (Pure Flutter):         ${String(t.tier1PureFlutter).padStart(3)} primitives ${chalk.green("✔ [AUTO]")} │`);
  console.log(`│  • Tier 2 (Ecosystem Plugin):      ${String(t.tier2EcosystemPlugins).padStart(3)} plugins    ${chalk.blue("○ [PUB]")}  │`);
  console.log(`│  • Tier 3 (Hybrid Native Bridge):  ${String(t.tier3HybridBridges).padStart(3)} bridges    ${t.tier3HybridBridges > 0 ? chalk.red("🛑 [HALT]") : chalk.gray("— [NONE]")} │`);
  console.log(`│  • Tier 4 (Custom Build):          ${String(t.tier4CustomBuildEscalations).padStart(3)} custom     ${t.tier4CustomBuildEscalations > 0 ? chalk.red("🛑 [HALT]") : chalk.gray("— [NONE]")} │`);
  console.log(chalk.bold.cyan("├────────────────────────────────────────────────────────┤"));
  if (isInteractive) {
    console.log(`│  Status: ${chalk.bold.red("🛑 INTERACTIVE ESCALATION GATE REQUIRED".padEnd(46))} │`);
  } else {
    console.log(`│  Status: ${chalk.bold.green("⚡ SEAMLESS VIBE-CODING (Ready for Auto-Codegen)".padEnd(46))} │`);
  }
  console.log(chalk.bold.cyan("└────────────────────────────────────────────────────────┘") + "\n");

  if (summary.recommendedPackages.length > 0) {
    console.log(chalk.bold.yellow(`📦 Recommended pub.dev packages: ${summary.recommendedPackages.join(", ")}`));
  }

  if (isInteractive && summary.escalations.length > 0) {
    console.log(chalk.bold.red(`⚠️  STOP: Component contains Tier 3/4 Native or Custom Constructs:`));
    for (const esc of summary.escalations) {
      console.log(chalk.red(`   - [${esc.id}] ${esc.sourceConstruct}: ${esc.reason}`));
      for (const opt of esc.options) {
        console.log(chalk.gray(`     * ${opt.optionId}: ${opt.label} — ${opt.description}`));
      }
    }
    console.log(chalk.bold.yellow(`\n👉 Mandatory Action: Present these options to user before writing production code.\n`));
  }
}

const program = new Command();

program
  .name("flutterin")
  .description("Reverse engineer anything into clean, idiomatic Flutter 3 / Dart 3 code.")
  .version("0.0.1");

// Command: doctor
program
  .command("doctor")
  .description("Diagnose host environment and Antigravity ecosystem synergy (optionally scoped to a profile).")
  .option("-p, --profile <profile>", "Filter diagnostics by profile (web-ui, mobile, native, full)")
  .action(async (options: { profile?: string }) => {
    const validProfile = options.profile as FlutterinProfile | undefined;
    const profileDef = validProfile ? PROFILE_DEFINITIONS[validProfile] : undefined;
    if (options.profile && !profileDef) {
      console.log(chalk.red(`\n✖ Invalid profile '${options.profile}'. Available: ${Object.keys(PROFILE_DEFINITIONS).join(", ")}\n`));
      process.exit(1);
    }

    console.log(chalk.bold.cyan(`\n🔍 Running Flutterin Doctor ${profileDef ? `[ Profile: ${profileDef.badge} ${profileDef.name} ]` : "[ All 6 Pillars ]"}...\n`));
    const doctor = new FlutterinDoctor();
    const report = await doctor.checkAll(validProfile);

    for (const [pillarName, tools] of Object.entries(report.pillars)) {
      console.log(chalk.bold.magenta(`[ ${pillarName} ]`));
      for (const t of tools) {
        if (t.installed) {
          console.log(`  ${chalk.green("✔")} ${chalk.bold(t.tool)}: ${chalk.gray(t.version || "Ready")} (${t.description})`);
        } else if (t.status === "core_missing") {
          console.log(`  ${chalk.red("✖")} ${chalk.bold(t.tool)}: ${chalk.red("Required Core Missing")} (${t.description})`);
        } else {
          console.log(`  ${chalk.yellow("○")} ${chalk.bold(t.tool)}: ${chalk.yellow("Optional Provider Missing")} (${t.description})`);
        }
      }
      console.log("");
    }

    console.log(chalk.bold.blue("[ Ecosystem Synergy ]"));
    console.log(
      `  ${report.ecosystemSynergy.officialFlutterPlugin ? chalk.green("✔") : chalk.yellow("○")} Official Dart & Flutter Plugin: ${
        report.ecosystemSynergy.officialFlutterPlugin ? chalk.green("Linked") : chalk.yellow("Not Found in ~/.gemini/config/plugins")
      }`
    );
    console.log(
      `  ${report.ecosystemSynergy.agentsWorkspace ? chalk.green("✔") : chalk.yellow("○")} .agents Portable-Brainvibing: ${
        report.ecosystemSynergy.agentsWorkspace ? chalk.green("Active") : chalk.gray("Standalone Mode")
      }`
    );
    console.log(`  ${chalk.green("✔")} Built-in Binary Decoders: ${chalk.green("Active (AXML, ARSC, ASAR, SourceMap, HAR, SQLite, ELF/Mach-O/PE)")}`);
    console.log(`\nOverall Health: ${report.overallStatus === "healthy" ? chalk.bold.green("READY FOR PRODUCTION") : chalk.bold.yellow("ACTION RECOMMENDED")}\n`);

    if (report.overallStatus !== "healthy") {
      const fixProfile = validProfile || "mobile";
      console.log(chalk.bold.yellow(`⚡ One-Click Remediation Available:`));
      console.log(`  Run: ${chalk.bold.white.bgBlack(` flutterin setup ${fixProfile} --fix `)} to batch-install missing tools via host package manager.\n`);
    }
  });

// Command: setup
program
  .command("setup [profile]")
  .description("Analyze missing dependencies and get tailored one-liner install commands for a target profile.")
  .option("-l, --list", "List all available profiles and what they require")
  .option("-f, --fix", "Automatically execute installation commands for missing tools")
  .action(async (profileArg: string | undefined, options: { list?: boolean; fix?: boolean } = {}) => {
    if (options.list || (!profileArg && process.argv.length <= 3)) {
      console.log(chalk.bold.cyan("\n📦 Flutterin Operational Profiles:\n"));
      for (const [key, p] of Object.entries(PROFILE_DEFINITIONS)) {
        console.log(`  ${chalk.bold.yellow(key.padEnd(8))} ${p.badge} ${chalk.bold(p.name)}`);
        console.log(`           ${chalk.gray(p.description)}`);
        console.log(`           Tools: ${chalk.cyan(p.toolIds.join(", "))}`);
        if (p.zeroExternalDeps) {
          console.log(`           ${chalk.green("⚡ ZERO external binary tools needed (Node & Python only)")}`);
        }
        console.log("");
      }
      console.log(chalk.gray("Usage: flutterin setup <profile> (e.g. flutterin setup web-ui)\n"));
      return;
    }

    const selectedProfile = (profileArg || "web-ui") as FlutterinProfile;
    if (!PROFILE_DEFINITIONS[selectedProfile]) {
      console.log(chalk.red(`\n✖ Unknown profile '${profileArg}'. Available profiles: ${Object.keys(PROFILE_DEFINITIONS).join(", ")}\n`));
      process.exit(1);
    }

    const analysis = await FlutterinSetup.analyzeProfile(selectedProfile);
    FlutterinSetup.printAnalysis(analysis);

    if (options.fix) {
      await FlutterinSetup.autoFix(analysis);
    }
  });

// Command: mcp
program
  .command("mcp")
  .description("Start the flutterin Model Context Protocol (MCP) server over stdio.")
  .action(async () => {
    const { startMcpServer } = await import("../mcp/index.js");
    await startMcpServer();
  });

// Command: mobile
program
  .command("mobile <packageFile>")
  .description("Decompile Android (.apk, .aab, .dex) or iOS (.ipa) package into clean-room Flutter 3 screens, native bridges, and models.")
  .option("-o, --output <outputDir>", "Output directory for decompiled Flutter project")
  .option("-n, --app-name <appName>", "Target project/app name to replace source fingerprints")
  .option("--package-id <packageId>", "Target reverse-domain package ID (e.g. com.mycompany.app)")
  .option("-i, --interactive", "Interactive prompt to auto-install missing optional tools (e.g. JADX) via package manager")
  .option("--interactive-gate", "Pause generation for screens requiring user decision on Tier 4 components")
  .option("--with-dna", "Force stamp .agents/.dna.json even in standalone mode")
  .option("--with-context", "Force generate 82-file context/ matrix in standalone mode")
  .option("--no-context", "Skip generating context/ matrix")
  .action(async (packageFile: string, options: {
    output?: string;
    appName?: string;
    packageId?: string;
    interactive?: boolean;
    interactiveGate?: boolean;
    withDna?: boolean;
    withContext?: boolean;
    context?: boolean;
  }) => {
    try {
      console.log(chalk.cyan(`\n📱 Ingesting target: ${path.basename(packageFile)} [Profile: mobile]`));
      const identity = IdentitySanitizer.resolveIdentity({
        userAppName: options.appName,
        userPackageId: options.packageId,
        sourceArtifactPath: packageFile,
        workspaceDir: options.output || process.cwd(),
      });
      const targetOut = options.output || path.join(path.dirname(packageFile), identity.dartPackageName);
      const env = MechanicalGuard.detectEcosystemMode(targetOut);

      // JIT Banner & Interactive Prompt (Suggestions 1 & 2)
      let jadxAvail = await AndroidDecompilerBridge.isCommandAvailable("jadx", ["--version"]);
      const jadxInstallCmd = (await FlutterinSetup.getInstallCommandForTool("jadx")) || "winget install Skylot.jadx";
      if (!jadxAvail) {
        console.log(chalk.yellow(`  ℹ Note: 'jadx' not detected. Decompiling using built-in Zero-Dependency AXML parser.`));
        console.log(chalk.gray(`    👉 Want full Java/Kotlin decompilation? Run: `) + chalk.cyan(jadxInstallCmd));
        console.log("");

        if (options.interactive && process.stdin.isTTY) {
          const pmList = await FlutterinSetup.detectPackageManagers();
          const pm = pmList[0] || (FlutterinSetup.detectOs() === "darwin" ? "brew" : "winget");
          console.log(chalk.yellow(`  [?] JADX is optional but recommended for full decompilation.`));
          const ans = await promptUser(`      Install automatically via ${pm}? [y/N/continue-with-builtin]: `);
          if (ans.toLowerCase() === "y" || ans.toLowerCase() === "yes") {
            console.log(chalk.cyan(`\n  ⚡ Auto-installing JADX: ${jadxInstallCmd}...\n`));
            try {
              const { stdout, stderr } = await execAsync(jadxInstallCmd, { timeout: 180000 });
              if (stdout) console.log(chalk.gray(stdout.trim()));
              if (stderr) console.log(chalk.gray(stderr.trim()));
              jadxAvail = await AndroidDecompilerBridge.isCommandAvailable("jadx", ["--version"]);
              if (jadxAvail) {
                console.log(chalk.green(`  ✔ JADX successfully installed! Proceeding with full decompilation.\n`));
              } else {
                console.log(chalk.yellow(`  ⚠ Install completed, but 'jadx' binary not found on PATH yet. Continuing with built-in parser.\n`));
              }
            } catch (err: any) {
              console.log(chalk.red(`  ✖ Automatic install failed: ${err?.message || err}`));
              console.log(chalk.yellow(`  Continuing with Built-in Pure TS/Python fallback without interruption.\n`));
            }
          } else {
            console.log(chalk.gray(`  Continuing with Built-in Pure TS/Python fallback without interruption.\n`));
          }
        }
      }

      const decompiler = new MobilePackageDecompiler();
      const report = await decompiler.decompile(packageFile, targetOut, {
        appName: identity.appName,
        packageId: identity.packageId,
        interactiveGate: options.interactiveGate,
        withDna: options.withDna,
      });

      // Context SSoT: Auto-generate in .agents synergy mode, or when explicitly requested via --with-context
      const shouldGenContext = options.context !== false && (env.mode === "agents_synergy" || options.withContext === true);
      let ctxSummary = "";
      if (shouldGenContext) {
        const ctxGen = new ContextGenerator();
        const ctxRes = await ctxGen.generateAsync(targetOut, path.join(targetOut, "context"), {
          appName: identity.appName,
          withDna: options.withDna,
        });
        ctxSummary = `${ctxRes.filesWritten.length + ctxRes.filesUpdated.length} SSoT files synced (context/)`;
      }

      const codeGen = new FlutterCodeGenerator();
      const allPackages = new Set<string>();
      const allEscalations: NonNullable<import("../ir/types.js").WidgetNode["escalation"]>[] = [];
      for (const s of report.decodedScreens) {
        const meta = codeGen.collectTreeMetadata(s.rootWidget);
        meta.recommendedPackages.forEach((p) => allPackages.add(p));
        allEscalations.push(...meta.escalations);
      }

      console.log(chalk.bold.green("\n  Decompilation Complete:"));
      console.log(`  Package Type: ${report.packageType}`);
      if (report.packageName) console.log(`  Package ID: ${chalk.bold(report.packageName)}`);
      if (report.versionName) console.log(`  Version: ${report.versionName} (${report.versionCode})`);
      if (ctxSummary) {
        console.log(`  Single Source of Truth: ${chalk.green(ctxSummary)}`);
      }
      console.log(`  Decoded Flutter Screens: ${chalk.green(report.decodedScreens.length)} (lib/presentation/screens/)`);
      if (allPackages.size > 0) {
        console.log(`  Tier 2 Ecosystem Plugins Recommended: ${chalk.yellow(Array.from(allPackages).join(", "))}`);
      }
      if (allEscalations.length > 0) {
        console.log(chalk.bold.yellow(`\n  [!] TIER 4 INTERACTIVE ESCALATION GATE (${allEscalations.length} Heavy Custom Components Detected):`));
        for (const esc of allEscalations) {
          console.log(`      - ${chalk.bold(esc.sourceConstruct)}: ${esc.reason}`);
          for (const opt of esc.options) {
            console.log(`        * [${chalk.cyan(opt.optionId)}] ${opt.label}: ${chalk.gray(opt.description)}`);
          }
        }
      }
      if (report.conversionSummary) {
        console.log(`  Execution Mode: ${report.conversionSummary.executionMode === "SEAMLESS_VIBE_CODING" ? chalk.green("SEAMLESS_VIBE_CODING (Pure Flutter / Plugin auto-fit)") : chalk.bold.yellow("INTERACTIVE_ESCALATION_REQUIRED")}`);
        if (report.conversionSummary.deferredScreens.length > 0) {
          console.log(`  Deferred Screens (Awaiting User Choice): ${chalk.yellow(report.conversionSummary.deferredScreens.join(", "))}`);
        }
      }
      if (report.dnaStamped) {
        console.log(`  Project DNA: ${chalk.green("Stamped (.agents/.dna.json - 5-Tier Architecture)")}`);
      } else {
        console.log(`  Architecture Mode: ${chalk.cyan("Standalone 5-Tier Flutter (No .agents coupling)")}`);
      }
      console.log(`  Output Directory: ${chalk.cyan(report.outputDir)}\n`);

      // Print Fidelity Scorecard (Suggestion 3)
      if (report.fidelityMetrics) {
        const metrics = report.fidelityMetrics;
        const totalScore = Math.round((metrics.layout + metrics.strings + metrics.nativeBridge + metrics.logic) / 4);
        let scoreLabel = totalScore >= 90 ? "High" : totalScore >= 70 ? "Medium" : "Low";
        const localeCount = Object.keys(report.localizedStringsArb).length;
        const localeTag = localeCount > 0 ? `(Extracted ${localeCount} locale${localeCount > 1 ? "s" : ""})` : "(Extracted locales)";

        console.log(`  ┌────────────────────────────────────────────────────────┐`);
        console.log(`  │  🎯 FLUTTERIN RECONSTRUCTION FIDELITY: ${totalScore}% (${scoreLabel})      │`);
        console.log(`  ├────────────────────────────────────────────────────────┤`);
        console.log(`  │  • UI Layouts & Widgets   : ${metrics.layout.toString().padStart(3, ' ')}% (Built-in Pure TS)    │`);
        console.log(`  │  • Localization (.arb)    : ${metrics.strings.toString().padStart(3, ' ')}% ${localeTag.padEnd(23)}│`);
        console.log(`  │  • Native Services Bridge : ${metrics.nativeBridge.toString().padStart(3, ' ')}% (MethodChannel ready) │`);
        console.log(`  │  • Bytecode Logic & Models: ${metrics.logic.toString().padStart(3, ' ')}% (AST fallback;        │`);
        if (metrics.logic < 100) {
          console.log(`  │                             install JADX for 100%)    │`);
        }
        console.log(`  └────────────────────────────────────────────────────────┘`);
      }

      // Safe-Edit Tip (Suggestion 5)
      console.log(chalk.gray(`\n  💡 Tip: You can safely edit the generated files! Re-running flutterin will only`));
      console.log(chalk.gray(`     refresh auto-inferred blocks and will NEVER overwrite your manual code.\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: adb
program
  .command("adb")
  .description("Inspect live Android device via ADB: list devices, dump live UI hierarchy, or pull installed APK.")
  .option("-l, --list", "List connected ADB devices")
  .option("-d, --dump", "Dump live UI hierarchy and clone into Flutter Widget")
  .option("-p, --pull <packageName>", "Pull installed APK to local disk")
  .option("-o, --output <outputPath>", "Output directory or file")
  .action(async (options: { list?: boolean; dump?: boolean; pull?: string; output?: string }) => {
    try {
      if (options.list) {
        const devices = await AndroidDecompilerBridge.listAdbDevices();
        console.log(chalk.bold.cyan("\nConnected ADB Devices:"));
        for (const d of devices) {
          console.log(`  ${chalk.green(d.id)} [${d.state}] ${d.model ? `Model: ${d.model}` : ""}`);
        }
        console.log("");
        return;
      }

      if (options.dump) {
        console.log(chalk.cyan("Dumping live screen hierarchy from device..."));
        const xml = await AndroidDecompilerBridge.dumpLiveUiHierarchy();
        const converter = new AndroidLayoutConverter();
        const codeGen = new FlutterCodeGenerator();
        const rootNode = converter.parseXml(xml);
        const dartCode = codeGen.generateScreen("LiveClonedScreen", rootNode);

        await outputOrPrint(dartCode, options.output);
        return;
      }

      if (options.pull) {
        console.log(chalk.cyan(`Pulling APK for ${options.pull}...`));
        const pulled = await AndroidDecompilerBridge.pullPackageApk(options.pull, options.output || process.cwd());
        console.log(chalk.bold.green(`✔ APK pulled successfully: ${pulled}`));
        return;
      }

      console.log(chalk.yellow("Specify --list, --dump, or --pull <package>. Run 'flutterin adb --help' for info."));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: unpack
program
  .command("unpack <file>")
  .description("Unpack an Electron (.asar) archive or reconstruct sources from a Source Map (.js.map).")
  .option("-o, --output <outputDir>", "Output directory")
  .action(async (file: string, options: { output?: string }) => {
    try {
      const resolvedOut = options.output || path.join(path.dirname(file), `${path.basename(file, path.extname(file))}_unpacked`);

      if (file.endsWith(".asar")) {
        console.log(chalk.cyan(`Unpacking Electron ASAR bundle: ${file}...`));
        const unpacker = new AsarUnpacker(file);
        const extracted = await unpacker.extractAll(resolvedOut);
        console.log(chalk.bold.green(`✔ Unpacked ${extracted.length} files to: ${resolvedOut}`));
      } else if (file.endsWith(".map") || file.endsWith(".js")) {
        console.log(chalk.cyan(`Reconstructing original sources from Source Map: ${file}...`));
        const content = await readFile(file, "utf8");
        const mapData = file.endsWith(".map")
          ? SourceMapReconstructor.parseSourceMap(content)
          : SourceMapReconstructor.extractEmbeddedSourceMap(content);

        if (!mapData) throw new Error("No source map found in provided file.");
        const result = SourceMapReconstructor.reconstruct(mapData);
        const written = await SourceMapReconstructor.writeReconstructedFiles(result, resolvedOut);
        console.log(chalk.bold.green(`✔ Reconstructed ${written.length} source files to: ${resolvedOut}`));
        console.log(`Frameworks detected: ${result.detectedFrameworks.join(", ") || "Standard"}`);
      } else {
        throw new Error("File must be an .asar archive or .js.map source map.");
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: inspect
program
  .command("inspect <file>")
  .description("Inspect an HTTP Archive (.har) into API contracts or SQLite (.db) into Drift schemas.")
  .option("-o, --output <outputPath>", "Optional output file path to write full generated Dart code")
  .action(async (file: string, options: { output?: string } = {}) => {
    try {
      const ext = path.extname(file).toLowerCase();
      if (ext === ".har") {
        console.log(chalk.cyan(`Parsing HAR capture: ${file}...`));
        const content = await readFile(file, "utf8");
        const res = HarSqliteInspector.parseHar(content);
        console.log(chalk.bold.green(`✔ Found ${res.endpoints.length} API endpoints and inferred ${res.models.length} Dart models.`));
        for (const ep of res.endpoints.slice(0, 10)) {
          console.log(`  [${chalk.bold(ep.method)}] ${ep.path} -> Inferred: ${chalk.cyan(ep.inferredModelName)}`);
        }
        if (options.output && res.models.length > 0) {
          const codeGen = new FlutterCodeGenerator();
          const fullModelsCode = res.models.map((m) => codeGen.generateDataModel(m)).join("\n\n");
          await outputOrPrint(fullModelsCode, options.output);
        }
      } else if (ext === ".db" || ext === ".sqlite" || ext === ".sqlite3") {
        console.log(chalk.cyan(`Inspecting SQLite database: ${file}...`));
        const res = await HarSqliteInspector.inspectSqlite(file);
        console.log(chalk.bold.green(`✔ Discovered ${res.tables.length} tables in database.`));
        for (const t of res.tables) {
          console.log(`  Table '${chalk.bold(t.tableName)}' (${t.rowCount} rows, ${t.columns.length} columns)`);
        }
        if (options.output) {
          await outputOrPrint(`${res.generatedDriftCode}\n${res.generatedDartEntities}`, options.output);
        } else {
          console.log("\n--- Sample Drift Code ---\n" + res.generatedDriftCode.slice(0, 500) + "...\n");
        }
      } else {
        throw new Error(`Unsupported file extension '${ext}' for inspect. Supported extensions: .har, .db, .sqlite, .sqlite3`);
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: android
program
  .command("android <file>")
  .description("Convert Android XML Layout file into a Flutter Dart Widget.")
  .option("-s, --screen-name <name>", "Name of the Flutter screen/widget", "AndroidScreen")
  .option("-o, --output <outputPath>", "Output Dart file path")
  .action(async (file: string, options: { screenName: string; output?: string }) => {
    try {
      console.log(chalk.cyan(`Converting Android XML layout: ${file}...`));
      const contentBuf = await readFile(file);
      const converter = new AndroidLayoutConverter();
      const codeGen = new FlutterCodeGenerator();

      const rootNode = converter.parseXml(contentBuf);
      const summary = summarizeConversion([{ name: options.screenName, root: rootNode }]);
      renderTierSummary(summary, options.screenName);

      const header = formatFeasibilityHeader(summary);
      const generatedCode = codeGen.generateScreen(options.screenName, rootNode);
      const dartCode = `${header}\n\n${generatedCode}`;

      await outputOrPrint(dartCode, options.output);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: web
program
  .command("web <file>")
  .description("Convert Web HTML / Tailwind file into a Flutter Dart Widget.")
  .option("-s, --screen-name <name>", "Name of the Flutter screen/widget", "WebScreen")
  .option("-o, --output <outputPath>", "Output Dart file path")
  .action(async (file: string, options: { screenName: string; output?: string }) => {
    try {
      console.log(chalk.cyan(`Converting Web HTML & Tailwind: ${file}...`));
      const content = await readFile(file, "utf-8");
      const converter = new HtmlTailwindConverter();
      const codeGen = new FlutterCodeGenerator();

      const rootNode = converter.parseHtml(content);
      const summary = summarizeConversion([{ name: options.screenName, root: rootNode }]);
      renderTierSummary(summary, options.screenName);

      const header = formatFeasibilityHeader(summary);
      const generatedCode = codeGen.generateScreen(options.screenName, rootNode);
      const dartCode = `${header}\n\n${generatedCode}`;

      await outputOrPrint(dartCode, options.output);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: react
program
  .command("react <file>")
  .description("Convert React Native / React JSX file into a Flutter Dart Widget.")
  .option("-s, --screen-name <name>", "Name of the Flutter screen/widget", "ReactScreen")
  .option("-o, --output <outputPath>", "Output Dart file path")
  .action(async (file: string, options: { screenName: string; output?: string }) => {
    try {
      console.log(chalk.cyan(`Converting React JSX component: ${file}...`));
      const content = await readFile(file, "utf-8");
      const converter = new ReactNativeConverter();
      const codeGen = new FlutterCodeGenerator();

      const rootNode = converter.parseJsx(content);
      const summary = summarizeConversion([{ name: options.screenName, root: rootNode }]);
      renderTierSummary(summary, options.screenName);

      const header = formatFeasibilityHeader(summary);
      const generatedCode = codeGen.generateScreen(options.screenName, rootNode);
      const dartCode = `${header}\n\n${generatedCode}`;

      await outputOrPrint(dartCode, options.output);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: ios
program
  .command("ios <file>")
  .description("Convert iOS SwiftUI file into a Flutter Dart Widget.")
  .option("-s, --screen-name <name>", "Name of the Flutter screen/widget", "IosScreen")
  .option("-o, --output <outputPath>", "Output Dart file path")
  .action(async (file: string, options: { screenName: string; output?: string }) => {
    try {
      console.log(chalk.cyan(`Converting SwiftUI view: ${file}...`));
      const content = await readFile(file, "utf-8");
      const converter = new SwiftUiConverter();
      const codeGen = new FlutterCodeGenerator();

      const rootNode = converter.parseSwiftUi(content);
      const summary = summarizeConversion([{ name: options.screenName, root: rootNode }]);
      renderTierSummary(summary, options.screenName);

      const header = formatFeasibilityHeader(summary);
      const generatedCode = codeGen.generateScreen(options.screenName, rootNode);
      const dartCode = `${header}\n\n${generatedCode}`;

      await outputOrPrint(dartCode, options.output);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: api
program
  .command("api <file>")
  .description("Convert JSON API payload into strongly-typed Dart Model & Dio Service.")
  .option("-m, --model-name <name>", "Name of the Dart model", "ItemModel")
  .option("-u, --url <url>", "Base endpoint URL", "https://api.example.com/items")
  .option("-o, --output <outputPath>", "Output Dart file path")
  .action(async (file: string, options: { modelName: string; url: string; output?: string }) => {
    try {
      console.log(chalk.cyan(`Converting API JSON: ${file}...`));
      const content = await readFile(file, "utf-8");
      const converter = new JsonModelConverter();
      const codeGen = new FlutterCodeGenerator();

      const model = converter.parseJson(options.modelName, content);
      const modelCode = codeGen.generateDataModel(model);
      const serviceCode = converter.generateDioService(options.modelName, options.url);

      const combined = `${modelCode}\n// --- Dio API Service ---\n\n${serviceCode}`;
      await outputOrPrint(combined, options.output);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: plan
program
  .command("plan <target>")
  .description("Generate a deterministic 5-Phase Porting Plan with 4-Tier Feasibility Analysis for a target file or project folder.")
  .option("-o, --output <outputPath>", "Output Markdown file path (e.g. implementation_plan.md)")
  .action(async (target: string, options: { output?: string }) => {
    try {
      console.log(chalk.cyan(`Generating 5-Phase Porting Plan for: ${target}...`));
      const targetPath = path.resolve(target);
      const isDir = fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory();

      const layoutFiles: string[] = [];
      if (isDir) {
        const findXmls = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !e.name.startsWith(".")) {
              findXmls(full);
            } else if (e.isFile() && e.name.endsWith(".xml") && full.includes("layout")) {
              layoutFiles.push(full);
            }
          }
        };
        findXmls(targetPath);
      } else if (targetPath.endsWith(".xml")) {
        layoutFiles.push(targetPath);
      }

      const converter = new AndroidLayoutConverter();
      const roots: { name: string; root: import("../ir/types.js").WidgetNode }[] = [];
      for (const f of layoutFiles) {
        try {
          const buf = fs.readFileSync(f);
          const screenName = path.basename(f, ".xml").replace(/[^a-zA-Z0-9]/g, "_");
          const rootNode = converter.parseXml(buf);
          roots.push({ name: screenName, root: rootNode });
        } catch {
          // ignore unparseable non-layout XMLs
        }
      }

      const summary = summarizeConversion(roots);
      const t = summary.tierCounts;
      const isInteractive = summary.executionMode === "INTERACTIVE_ESCALATION_REQUIRED";

      let md = `# 📋 5-Phase Porting Plan: ${path.basename(targetPath)}\n\n`;
      md += `> **Feasibility Mode**: ${isInteractive ? "🛑 INTERACTIVE ESCALATION GATE REQUIRED" : "⚡ SEAMLESS VIBE-CODING"}\n`;
      md += `> **Tier Distribution**: Tier 1: ${t.tier1PureFlutter} | Tier 2: ${t.tier2EcosystemPlugins} | Tier 3: ${t.tier3HybridBridges} | Tier 4: ${t.tier4CustomBuildEscalations}\n\n`;

      md += `## ⚖️ 4-Tier Component Classification Matrix\n\n`;
      md += `| Target Screen / Component | Tier | Execution Recommendation |\n`;
      md += `| :--- | :--- | :--- |\n`;
      for (const r of roots) {
        const s = summarizeConversion([r]);
        const tier = s.tierCounts.tier4CustomBuildEscalations > 0 ? "Tier 4 (Custom Build)" :
                     s.tierCounts.tier3HybridBridges > 0 ? "Tier 3 (Hybrid Bridge)" :
                     s.tierCounts.tier2EcosystemPlugins > 0 ? "Tier 2 (Ecosystem Plugin)" :
                     "Tier 1 (Pure Flutter)";
        const rec = tier.startsWith("Tier 3") || tier.startsWith("Tier 4") ? "🛑 Present tradeoffs to user before coding" : "⚡ Safe for auto-codegen";
        md += `| \`${r.name}\` | **${tier}** | ${rec} |\n`;
      }
      if (roots.length === 0) {
        md += `| *(Target contains no direct layout XML files)* | Tier 1/2 | Inferred from contracts |\n`;
      }
      md += `\n`;

      if (summary.escalations.length > 0) {
        md += `## 🛑 Pending Interactive Escalations\n\n`;
        for (const esc of summary.escalations) {
          md += `### \`${esc.sourceConstruct}\` (${esc.recommendedTier})\n`;
          md += `* **Reason**: ${esc.reason}\n`;
          md += `* **Decision Options**:\n`;
          for (const opt of esc.options) {
            md += `  - **${opt.optionId}**: ${opt.label} — ${opt.description}\n`;
          }
          md += `\n`;
        }
      }

      md += `## 🚀 Phased Flutter 3 Porting Sequence\n\n`;
      md += `### Phase 1: Data Models & Persistence (\`lib/models/\` or \`lib/contracts/\`)\n`;
      md += `- [ ] Reconstruct SQLite schemas or SharedPreferences models into immutable Dart 3 classes.\n`;
      md += `- [ ] Write unit tests for serialization (\`fromJson\` / \`toJson\`).\n\n`;

      md += `### Phase 2: Services & Platform Bridges (\`lib/services/\` or \`lib/core/bridge/\`)\n`;
      md += `- [ ] Resolve all Tier 3 / Tier 4 escalations with user confirmation.\n`;
      md += `- [ ] Implement MethodChannels and native host handlers for OS-level actions.\n\n`;

      md += `### Phase 3: Design Tokens & Theme (\`lib/theme/\`)\n`;
      md += `- [ ] Extract XML color/style tokens into Material 3 \`ThemeData\`.\n\n`;

      md += `### Phase 4: Screens & Components (\`lib/presentation/\`)\n`;
      md += `- [ ] Convert Tier 1 layouts via \`flutterin android <layout.xml>\`.\n`;
      md += `- [ ] Embed verified Tier 2 plugins and Tier 3 PlatformViews.\n\n`;

      md += `### Phase 5: Router & App State (\`lib/state/\` or \`lib/router/\`)\n`;
      md += `- [ ] Wire declarative navigation (\`GoRouter\`) and state providers.\n`;
      md += `- [ ] Verify zero analyzer warnings (\`flutter analyze\`) and 100% test pass rate.\n`;

      renderTierSummary(summary, path.basename(targetPath));

      if (options.output) {
        fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
        await writeFile(options.output, md, "utf-8");
        console.log(chalk.green(`✔ 5-Phase Porting Plan saved to: ${options.output}`));
      } else {
        console.log("\n" + chalk.bold.green("--- Generated 5-Phase Porting Plan ---") + "\n");
        console.log(md);
      }
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: binary
program
  .command("binary <binaryFile>")
  .description("Inspect an AOT binary (libapp.so) or native ELF/PE/Mach-O/WASM binary.")
  .action(async (binaryFile: string) => {
    try {
      console.log(chalk.cyan(`Analyzing binary: ${binaryFile}...`));
      const reader = new AotSnapshotReader();
      const report = await reader.analyzeBinary(binaryFile);

      console.log(chalk.bold("\n--- Binary Analysis Report ---"));
      console.log(`Architecture: ${chalk.green(report.architecture)}`);
      console.log(`Is Flutter Binary: ${report.isFlutterBinary ? chalk.green("YES") : chalk.yellow("NO")}`);
      if (report.snapshotHash) {
        console.log(`Snapshot Hash: ${chalk.yellow(report.snapshotHash)}`);
      }
      if (report.dartVersion) {
        console.log(`Dart Version: ${chalk.cyan(report.dartVersion)}`);
      }
      if (report.engineCommits.length > 0) {
        console.log(`Engine Commits: ${chalk.gray(report.engineCommits.join(", "))}`);
      }

      if (report.matchedEngine) {
        console.log(chalk.bold.green("\n✔ Matched Engine Catalog:"));
        console.log(`  Flutter Version: ${chalk.bold(report.matchedEngine.flutterVersion)}`);
        console.log(`  Engine Commit: ${report.matchedEngine.engineCommit}`);
        if (report.matchedEngine.dartVersion) {
          console.log(`  Target Dart Version: ${report.matchedEngine.dartVersion}`);
        }
      }

      if (report.nativeAnalysis) {
        console.log(chalk.bold.blue("\n--- Native Binary & Symbol Inspection ---"));
        console.log(`Format: ${chalk.bold(report.nativeAnalysis.format)} (${report.nativeAnalysis.arch})`);
        console.log(`Sections: ${report.nativeAnalysis.sections.join(", ") || "None"}`);
        console.log(`Exported Symbols: ${chalk.green(report.nativeAnalysis.exportedSymbols.length)}`);
        if (report.nativeAnalysis.dartFfiWrapperCode) {
          console.log(chalk.bold.green("\n✔ Generated Dart FFI Binding Preview:"));
          console.log(report.nativeAnalysis.dartFfiWrapperCode.slice(0, 400) + "...\n");
        }
      }
      console.log("");
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: interceptor
program
  .command("interceptor")
  .description("Generate a dynamic SSL verification bypass script for HTTPS traffic capture.")
  .option("-p, --package <package>", "Target Android package name", "com.example.app")
  .option("-h, --host <host>", "Proxy host IP (e.g. 127.0.0.1)")
  .option("-P, --port <port>", "Proxy port (e.g. 8080)", (v) => parseInt(v, 10))
  .option("-o, --output <outputPath>", "Output script path", "interceptor.js")
  .action(async (options: { package: string; host?: string; port?: number; output: string }) => {
    try {
      const generator = new SslBypassGenerator();
      const script = generator.generateFridaScript({
        packageName: options.package,
        proxyHost: options.host,
        proxyPort: options.port,
      });

      if (options.output) {
        fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
      }
      await writeFile(options.output, script, "utf-8");
      console.log(chalk.green(`\n✔ Dynamic interceptor script generated at: ${options.output}`));
      console.log(chalk.cyan(`Run with: frida -U -f ${options.package} -l ${options.output}\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: context
program
  .command("context <sourcePath>")
  .description("Scan source or reverse-engineered assets and generate epistemic context for the 82-file registry.")
  .option("-o, --output <contextDir>", "Target context directory", "./context")
  .option("-a, --all-slots", "Scaffold all 82 empty registry slots instead of signal-backed only", false)
  .option("-p, --profile <profile>", "Context profile archetype: utility | connected | saas | auto")
  .option("-n, --app-name <appName>", "Override inferred application name")
  .action(async (sourcePath: string, options: { output: string; allSlots: boolean; profile?: "utility" | "connected" | "saas" | "auto"; appName?: string }) => {
    try {
      console.log(chalk.cyan(`\n🔍 Inspecting source signals for Epistemic Auto-Context: ${sourcePath}...`));
      const generator = new ContextGenerator();
      const res = await generator.generateAsync(sourcePath, options.output, {
        allSlots: options.allSlots,
        profile: options.profile,
        appName: options.appName,
      });

      console.log(chalk.bold.green("\n✔ Epistemic Context Generation Complete:"));
      console.log(`  Target Directory: ${chalk.bold(res.targetDir)}`);
      console.log(`  Signals Extracted:`);
      console.log(`    - Package ID: ${chalk.bold(res.signals.packageName || "None")}`);
      console.log(`    - Permissions: ${res.signals.permissions.length}`);
      console.log(`    - Screen Activities: ${res.signals.activities.length}`);
      console.log(`    - Theme Colors: ${Object.keys(res.signals.colors).length}`);
      console.log(`    - SQLite Schemas: ${res.signals.sqliteTables.length}`);
      console.log(`    - Network Endpoints: ${res.signals.apiEndpoints.length}`);
      console.log(`    - Detected SDKs: ${res.signals.detectedSdks.map((s) => s.name).join(", ") || "None"}`);
      console.log(`  Files Written: ${chalk.green(res.filesWritten.length)}`);
      for (const f of res.filesWritten) {
        console.log(`    ${chalk.green("+")} ${f}`);
      }
      if (res.filesUpdated.length > 0) {
        console.log(`  Files Updated (Bounded Anchors Preserved): ${chalk.yellow(res.filesUpdated.length)}`);
        for (const f of res.filesUpdated) {
          console.log(`    ${chalk.yellow("~")} ${f}`);
        }
      }
      const env = MechanicalGuard.detectEcosystemMode(res.targetDir);
      if (res.dnaStamped) {
        console.log(`  Project DNA: ${chalk.green("Preserved / Enriched in .agents/.dna.json (5-Tier Architecture)")}`);
      } else {
        console.log(`  Architecture Mode: ${chalk.cyan("Standalone 5-Tier Flutter (No .agents coupling)")}`);
      }
      if (env.hasOrionScript) {
        console.log(`\n${chalk.gray("Follow-up: Run 'python .agents/scripts/orion.py brain ingest context/' to index into brain graph.")}`);
      } else {
        console.log(`\n${chalk.gray(`Context files ready in ${res.targetDir} (Standalone Mode - no .agents required).`)}`);
      }
      console.log(chalk.gray(`\n  💡 Tip: You can safely edit the generated files! Re-running flutterin will only`));
      console.log(chalk.gray(`     refresh auto-inferred blocks and will NEVER overwrite your manual code.\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: sync / update (Suggestion 5)
program
  .command("sync <targetPath>")
  .alias("update")
  .description("Clean non-destructive re-scan: refresh auto-inferred context and screens while preserving manual code.")
  .option("-o, --output <outputDir>", "Context output directory", "./context")
  .option("-n, --app-name <appName>", "Override inferred application name")
  .action(async (targetPath: string, options: { output: string; appName?: string }) => {
    try {
      console.log(chalk.cyan(`\n🔄 Syncing and re-scanning target: ${targetPath}...`));
      const generator = new ContextGenerator();
      const res = await generator.generateAsync(targetPath, options.output, {
        appName: options.appName,
      });

      console.log(chalk.bold.green("\n✔ Sync & Re-Scan Complete:"));
      console.log(`  Target Directory: ${chalk.bold(res.targetDir)}`);
      console.log(`  Files Written: ${chalk.green(res.filesWritten.length)}`);
      console.log(`  Files Updated (Bounded Anchors Preserved): ${chalk.yellow(res.filesUpdated.length)}`);
      console.log(chalk.gray(`\n  💡 Tip: You can safely edit the generated files! Re-running flutterin will only`));
      console.log(chalk.gray(`     refresh auto-inferred blocks and will NEVER overwrite your manual code.\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

// Command: reverse-flutter
program
  .command("reverse-flutter <targetPath>")
  .description("Reverse-engineer Flutter APK, IPA, libapp.so, or decompiler output (reFlutter/blutter) and populate the 82-file SaaS Context Matrix.")
  .option("-o, --output <contextDir>", "Target context directory", "./context")
  .option("--reflutter-dump <path>", "Path to reFlutter dump.dart or JSONL symbol file")
  .option("--blutter-dir <path>", "Path to blutter output directory containing pp.txt and asm/*.dart")
  .option("-a, --all-slots", "Generate all 82 granular files + 5 masters", true)
  .option("-p, --profile <profile>", "Archetype profile (utility | connected | saas | auto)", "auto")
  .option("-n, --app-name <appName>", "Override inferred application name")
  .action(async (targetPath: string, options: {
    output: string;
    reflutterDump?: string;
    blutterDir?: string;
    allSlots: boolean;
    profile?: "utility" | "connected" | "saas" | "auto";
    appName?: string;
  }) => {
    try {
      console.log(chalk.cyan(`\n🔍 Reverse-engineering Flutter target: ${targetPath}...`));
      const generator = new ContextGenerator();
      const res = await generator.generateAsync(targetPath, options.output, {
        allSlots: options.allSlots !== false,
        appName: options.appName,
        profile: options.profile,
        reflutterDumpPath: options.reflutterDump,
        blutterDir: options.blutterDir,
      });

      console.log(chalk.bold.green("\n✔ Flutter Reverse-Engineering & Context Synthesis Complete:"));
      console.log(`  Target Directory: ${chalk.bold(res.targetDir)}`);
      if (res.signals.flutterAnalysis) {
        const fa = res.signals.flutterAnalysis;
        console.log(`  Flutter Application Insights:`);
        console.log(`    - Application Name: ${chalk.bold(fa.appName)}`);
        console.log(`    - Package Name: ${chalk.bold(fa.packageName || "Unknown")}`);
        console.log(`    - Engine Version: ${chalk.bold(fa.engine?.flutterVersion || "Flutter 3.x AOT")} (${fa.isShorebird ? "Shorebird" : "Vanilla"})`);
        console.log(`    - Bundled Pub Packages: ${fa.pubPackages.length}`);
        console.log(`    - Discovered UI Screens: ${fa.discoveredScreens.length}`);
        console.log(`    - Feature Modules: ${fa.featureModules.length}`);
        console.log(`    - Discovered Endpoints: ${fa.discoveredEndpoints.length}`);
        console.log(`    - Discovered Storage Tables: ${fa.discoveredTables.length}`);
        console.log(`    - Embedded Assets: ${fa.assets.length}`);
      }
      console.log(`  Context Files Written: ${chalk.green(res.filesWritten.length)}`);
      for (const f of res.filesWritten) {
        console.log(`    ${chalk.green("+")} ${f}`);
      }
      if (res.filesUpdated.length > 0) {
        console.log(`  Context Files Updated (Preserving Manual Notes): ${chalk.yellow(res.filesUpdated.length)}`);
        for (const f of res.filesUpdated) {
          console.log(`    ${chalk.yellow("~")} ${f}`);
        }
      }
      const env = MechanicalGuard.detectEcosystemMode(res.targetDir);
      if (res.dnaStamped) {
        console.log(`  Project DNA: ${chalk.green("Preserved / Enriched in .agents/.dna.json (5-Tier Architecture)")}`);
      } else {
        console.log(`  Architecture Mode: ${chalk.cyan("Standalone 5-Tier Flutter (No .agents coupling)")}`);
      }
      if (env.hasOrionScript) {
        console.log(`\n${chalk.gray("Follow-up: Run 'python .agents/scripts/orion.py brain ingest context/' to index into brain graph.")}`);
      } else {
        console.log(`\n${chalk.gray(`Context files ready in ${res.targetDir} (Standalone Mode - no .agents required).`)}`);
      }
      console.log(chalk.gray(`\n  💡 Tip: You can safely edit the generated files! Re-running flutterin will only`));
      console.log(chalk.gray(`     refresh auto-inferred blocks and will NEVER overwrite your manual code.\n`));
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err?.message || err}`));
      process.exit(1);
    }
  });

async function outputOrPrint(code: string, outputPath?: string) {
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    await writeFile(outputPath, code, "utf-8");
    console.log(chalk.green(`✔ Output saved to: ${outputPath}`));
  } else {
    console.log("\n" + chalk.bold.green("--- Generated Flutter / Dart Code ---") + "\n");
    console.log(code);
  }
}

program.parse(process.argv);
