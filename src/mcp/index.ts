import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { AndroidLayoutConverter } from "../targets/android/layoutConverter.js";
import { HtmlTailwindConverter } from "../targets/web/htmlTailwindConverter.js";
import { ReactNativeConverter } from "../targets/react/reactNativeConverter.js";
import { SwiftUiConverter } from "../targets/ios/swiftUiConverter.js";
import { JsonModelConverter } from "../targets/api/jsonModelConverter.js";
import { AotSnapshotReader } from "../targets/binary/aotSnapshotReader.js";
import { SslBypassGenerator } from "../targets/network/sslBypassGenerator.js";
import { FlutterCodeGenerator } from "../generators/flutterCodeGenerator.js";
import { FlutterinDoctor } from "../tools/doctor.js";
import { type FlutterinProfile } from "../tools/profiles.js";
import { MobilePackageDecompiler } from "../core/decoders/mobilePackageDecompiler.js";
import { AsarUnpacker } from "../core/decoders/asarUnpacker.js";
import { SourceMapReconstructor } from "../core/decoders/sourceMapReconstructor.js";
import { HarSqliteInspector } from "../core/decoders/harSqliteInspector.js";
import { AndroidDecompilerBridge } from "../core/bridges/androidDecompilerBridge.js";
import { EngineCatalog } from "../targets/binary/engineCatalog.js";
import { ContextGenerator } from "../generators/contextGenerator.js";
import { IdentitySanitizer } from "../core/identitySanitizer.js";
import { MechanicalGuard } from "../core/mechanicalGuard.js";
import { summarizeConversion, formatFeasibilityHeader } from "../ir/feasibility.js";

export async function startMcpServer() {
  const server = new Server(
    {
      name: "flutterin",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const androidConverter = new AndroidLayoutConverter();
  const webConverter = new HtmlTailwindConverter();
  const reactConverter = new ReactNativeConverter();
  const swiftUiConverter = new SwiftUiConverter();
  const jsonConverter = new JsonModelConverter();
  const aotReader = new AotSnapshotReader();
  const sslGenerator = new SslBypassGenerator();
  const codeGen = new FlutterCodeGenerator();
  const doctor = new FlutterinDoctor();
  const mobileDecompiler = new MobilePackageDecompiler();

  // List tools available to the AI agent
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "flutterin_doctor",
          description: "Diagnose host environment and Antigravity ecosystem synergy (optionally scoped to a profile: web-ui, mobile, native, full).",
          inputSchema: {
            type: "object",
            properties: {
              profile: {
                type: "string",
                enum: ["web-ui", "mobile", "native", "full"],
                description: "Optional profile filter to evaluate only tools required for your workflow (default: all)",
              },
            },
          },
        },
        {
          name: "flutterin_decompile_mobile_package",
          description: "Decompiles an Android (.apk, .aab, .dex) or iOS (.ipa) package into Flutter 3 widgets, models, localized strings (.arb), and assets.",
          inputSchema: {
            type: "object",
            properties: {
              packagePath: {
                type: "string",
                description: "Path to .apk, .aab, .dex, or .ipa file",
              },
              outputDir: {
                type: "string",
                description: "Output directory for decompiled Flutter source code",
              },
              appName: {
                type: "string",
                description: "Target project/app name to replace source fingerprints",
              },
              packageId: {
                type: "string",
                description: "Target reverse-domain package ID (e.g. com.mycompany.app)",
              },
            },
            required: ["packagePath"],
          },
        },
        {
          name: "flutterin_adb_inspect_live",
          description: "Inspects a connected Android device or emulator via ADB: list devices, dump live runtime UI hierarchy, or pull an installed APK.",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list_devices", "dump_ui_hierarchy", "pull_apk"],
                description: "Action to perform",
              },
              packageName: {
                type: "string",
                description: "Package name when action is pull_apk (e.g. com.example.app)",
              },
              outputDir: {
                type: "string",
                description: "Output directory for pulled APK",
              },
            },
            required: ["action"],
          },
        },
        {
          name: "flutterin_unpack_web_electron",
          description: "Unpacks an Electron (.asar) archive or reconstructs original source files from a JavaScript Source Map (.js.map).",
          inputSchema: {
            type: "object",
            properties: {
              targetPath: {
                type: "string",
                description: "Path to app.asar file or .js.map file",
              },
              outputDir: {
                type: "string",
                description: "Directory to extract unpacked files into",
              },
            },
            required: ["targetPath"],
          },
        },
        {
          name: "flutterin_inspect_har_sqlite",
          description: "Parses an HTTP Archive (.har) into REST API contracts & Dart models, or inspects a local SQLite (.db/.sqlite) file into Drift schemas and Dart entities.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Path to .har or .sqlite/.db file",
              },
            },
            required: ["filePath"],
          },
        },
        {
          name: "flutterin_analyze_binary",
          description: "Analyzes Flutter AOT (libapp.so) or native ELF, PE, Mach-O, and WASM binaries, extracting symbols, snapshot hashes, and generating Dart FFI bindings.",
          inputSchema: {
            type: "object",
            properties: {
              filePath: {
                type: "string",
                description: "Path to binary file (libapp.so, .dll, .so, .dylib, .wasm)",
              },
            },
            required: ["filePath"],
          },
        },
        {
          name: "flutterin_convert_android",
          description: "Converts Android XML (decompiled text XML or binary AXML) layout markup into idiomatic Flutter Widget Dart code.",
          inputSchema: {
            type: "object",
            properties: {
              screenName: {
                type: "string",
                description: "Name of the Flutter screen/widget (e.g. LoginScreen, ProfileView)",
              },
              xmlContent: {
                type: "string",
                description: "Raw Android XML markup or base64 binary AXML",
              },
            },
            required: ["screenName", "xmlContent"],
          },
        },
        {
          name: "flutterin_convert_web",
          description: "Converts Web HTML and Tailwind CSS classes into idiomatic Flutter Widget Dart code.",
          inputSchema: {
            type: "object",
            properties: {
              screenName: {
                type: "string",
                description: "Name of the Flutter screen/widget",
              },
              htmlContent: {
                type: "string",
                description: "HTML markup with Tailwind CSS classes",
              },
            },
            required: ["screenName", "htmlContent"],
          },
        },
        {
          name: "flutterin_convert_react",
          description: "Converts React Native / React JSX markup into idiomatic Flutter Widget Dart code.",
          inputSchema: {
            type: "object",
            properties: {
              screenName: {
                type: "string",
                description: "Name of the Flutter screen/widget",
              },
              jsxContent: {
                type: "string",
                description: "React Native JSX component code",
              },
            },
            required: ["screenName", "jsxContent"],
          },
        },
        {
          name: "flutterin_convert_ios",
          description: "Converts iOS SwiftUI View declarations and modifiers into Flutter Widget Dart code.",
          inputSchema: {
            type: "object",
            properties: {
              screenName: {
                type: "string",
                description: "Name of the Flutter screen/widget",
              },
              swiftUiContent: {
                type: "string",
                description: "SwiftUI View code",
              },
            },
            required: ["screenName", "swiftUiContent"],
          },
        },
        {
          name: "flutterin_generate_models",
          description: "Converts an API JSON sample into strongly-typed Dart model classes with pattern matching and Dio HTTP client.",
          inputSchema: {
            type: "object",
            properties: {
              modelName: {
                type: "string",
                description: "Name of the Dart model class (e.g. UserProfile, OrderItem)",
              },
              jsonString: {
                type: "string",
                description: "Sample JSON string payload",
              },
              endpointUrl: {
                type: "string",
                description: "Optional base URL endpoint for Dio service client",
              },
            },
            required: ["modelName", "jsonString"],
          },
        },
        {
          name: "flutterin_list_engines",
          description: "Queries the 677+ Flutter Engine catalog to find snapshot hashes, commit provenance, and Dart versions.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Commit hash or snapshot hash to search for (empty returns total count and sample)",
              },
            },
          },
        },
        {
          name: "flutterin_generate_interceptor",
          description: "Generates a Frida runtime SSL verification bypass script for capturing HTTPS traffic without root certificates.",
          inputSchema: {
            type: "object",
            properties: {
              packageName: {
                type: "string",
                description: "Target Android package name",
              },
              proxyHost: {
                type: "string",
                description: "Proxy host IP (e.g. 127.0.0.1)",
              },
              proxyPort: {
                type: "number",
                description: "Proxy port (e.g. 8080)",
              },
            },
            required: ["packageName"],
          },
        },
        {
          name: "flutterin_generate_context",
          description: "Scans project source or reverse-engineered assets and populates the .agents 82-file SaaS Context Matrix with epistemic confidence tags and non-destructive merge anchors.",
          inputSchema: {
            type: "object",
            properties: {
              sourcePath: {
                type: "string",
                description: "Path to input source folder, decompiled APK, or reverse engineering staging dir",
              },
              targetContextDir: {
                type: "string",
                description: "Target context directory (default: ./context)",
              },
              allSlots: {
                type: "boolean",
                description: "Whether to scaffold all 82 empty template files or only signal-backed files (default: false)",
              },
              appName: {
                type: "string",
                description: "Override inferred application name",
              },
              profile: {
                type: "string",
                enum: ["utility", "connected", "saas", "auto"],
                description: "Optional archetype profile filter (utility, connected, saas, auto)",
              },
            },
            required: ["sourcePath"],
          },
        },
        {
          name: "flutterin_reverse_flutter_to_context",
          description: "Reverse-engineers Flutter applications (APK, IPA, libapp.so, reFlutter dump.dart, or blutter output dir) and synthesizes the full 82-file SaaS Context Matrix with non-destructive merge anchors.",
          inputSchema: {
            type: "object",
            properties: {
              targetPath: {
                type: "string",
                description: "Path to Flutter APK, IPA, libapp.so, or decompiler output directory",
              },
              targetContextDir: {
                type: "string",
                description: "Target context directory (default: ./context)",
              },
              reflutterDumpPath: {
                type: "string",
                description: "Path to reFlutter dump.dart or JSONL symbol file",
              },
              blutterDir: {
                type: "string",
                description: "Path to blutter output directory containing pp.txt and asm/*.dart",
              },
              allSlots: {
                type: "boolean",
                description: "Whether to populate all 82 files + 5 masters (default: true)",
              },
              appName: {
                type: "string",
                description: "Override inferred application name",
              },
              profile: {
                type: "string",
                enum: ["utility", "connected", "saas", "auto"],
                description: "Optional archetype profile filter (utility, connected, saas, auto)",
              },
            },
            required: ["targetPath"],
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "flutterin_doctor": {
          const profile = (args as any)?.profile as FlutterinProfile | undefined;
          const report = await doctor.checkAll(profile);
          return {
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          };
        }

        case "flutterin_decompile_mobile_package": {
          const { packagePath, outputDir, appName, packageId, generateContext, withDna } = args as {
            packagePath: string;
            outputDir?: string;
            appName?: string;
            packageId?: string;
            generateContext?: boolean;
            withDna?: boolean;
          };
          const identity = IdentitySanitizer.resolveIdentity({
            userAppName: appName,
            userPackageId: packageId,
            sourceArtifactPath: packagePath,
            workspaceDir: outputDir || process.cwd(),
          });
          const targetOut = outputDir || path.join(path.dirname(packagePath), identity.dartPackageName);
          const env = MechanicalGuard.detectEcosystemMode(targetOut);

          const report = await mobileDecompiler.decompile(packagePath, targetOut, {
            appName: identity.appName,
            packageId: identity.packageId,
            withDna,
          });

          // Only auto-generate context/ SSoT in .agents synergy mode or when explicitly requested
          if (generateContext === true || (generateContext === undefined && env.mode === "agents_synergy")) {
            try {
              const ctxGen = new ContextGenerator();
              await ctxGen.generateAsync(targetOut, path.join(targetOut, "context"), {
                appName: identity.appName,
                withDna,
              });
            } catch {
              // Non-fatal
            }
          }

          return {
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          };
        }

        case "flutterin_adb_inspect_live": {
          const { action, packageName, outputDir } = args as {
            action: "list_devices" | "dump_ui_hierarchy" | "pull_apk";
            packageName?: string;
            outputDir?: string;
          };

          if (action === "list_devices") {
            const devices = await AndroidDecompilerBridge.listAdbDevices();
            return { content: [{ type: "text", text: JSON.stringify(devices, null, 2) }] };
          } else if (action === "dump_ui_hierarchy") {
            const xml = await AndroidDecompilerBridge.dumpLiveUiHierarchy();
            // Automatically convert UI hierarchy to Flutter Widget
            let flutterScreen: string | undefined;
            try {
              const rootWidget = androidConverter.parseXml(xml);
              flutterScreen = codeGen.generateScreen("LiveClonedScreen", rootWidget);
            } catch {
              // ignore
            }
            return {
              content: [
                { type: "text", text: xml },
                ...(flutterScreen ? [{ type: "text", text: `// --- Auto-generated Flutter Clone ---\n${flutterScreen}` }] : []),
              ],
            };
          } else if (action === "pull_apk") {
            if (!packageName) throw new Error("packageName is required for pull_apk");
            const targetDir = outputDir || process.cwd();
            const pulledPath = await AndroidDecompilerBridge.pullPackageApk(packageName, targetDir);
            return { content: [{ type: "text", text: `Successfully pulled APK to: ${pulledPath}` }] };
          }
          throw new Error(`Unknown ADB action: ${action}`);
        }

        case "flutterin_unpack_web_electron": {
          const { targetPath, outputDir } = args as { targetPath: string; outputDir?: string };
          const resolvedOut = outputDir || path.join(path.dirname(targetPath), `${path.basename(targetPath, path.extname(targetPath))}_unpacked`);

          if (targetPath.endsWith(".asar")) {
            const unpacker = new AsarUnpacker(targetPath);
            const extracted = await unpacker.extractAll(resolvedOut);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      format: "ASAR",
                      extractedCount: extracted.length,
                      outputDirectory: resolvedOut,
                      sampleFiles: extracted.slice(0, 20),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          } else if (targetPath.endsWith(".map") || targetPath.endsWith(".js")) {
            const content = fs.readFileSync(targetPath, "utf8");
            let mapData = targetPath.endsWith(".map")
              ? SourceMapReconstructor.parseSourceMap(content)
              : SourceMapReconstructor.extractEmbeddedSourceMap(content);

            if (!mapData) {
              throw new Error("No source map found in provided file.");
            }

            const result = SourceMapReconstructor.reconstruct(mapData);
            const written = await SourceMapReconstructor.writeReconstructedFiles(result, resolvedOut);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      format: "SourceMap",
                      reconstructedFilesCount: written.length,
                      frameworksDetected: result.detectedFrameworks,
                      outputDirectory: resolvedOut,
                      sampleFiles: written.slice(0, 20),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }
          throw new Error("Unsupported format. Please provide an .asar or .js.map file.");
        }

        case "flutterin_inspect_har_sqlite": {
          const { filePath } = args as { filePath: string };
          const ext = path.extname(filePath).toLowerCase();

          if (ext === ".har") {
            const content = fs.readFileSync(filePath, "utf8");
            const result = HarSqliteInspector.parseHar(content);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          } else if (ext === ".sqlite" || ext === ".db" || ext === ".sqlite3") {
            const result = await HarSqliteInspector.inspectSqlite(filePath);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      tableCount: result.tables.length,
                      tables: result.tables.map((t) => ({ name: t.tableName, rows: t.rowCount, columns: t.columns.map((c) => c.name) })),
                    },
                    null,
                    2
                  ),
                },
                { type: "text", text: `// --- Drift Database Schema ---\n${result.generatedDriftCode}` },
                { type: "text", text: `// --- Dart Entities ---\n${result.generatedDartEntities}` },
              ],
            };
          }
          throw new Error(`Unsupported file type: ${ext}. Please supply a .har or .sqlite/.db file.`);
        }

        case "flutterin_analyze_binary": {
          const { filePath } = args as { filePath: string };
          const report = await aotReader.analyzeBinary(filePath);
          return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
        }

        case "flutterin_convert_android": {
          const { screenName, xmlContent } = args as { screenName: string; xmlContent: string };
          const rootNode = androidConverter.parseXml(xmlContent);
          const dartCode = codeGen.generateScreen(screenName, rootNode);
          const summary = summarizeConversion([{ name: screenName, root: rootNode }]);
          const header = formatFeasibilityHeader(summary);
          return { content: [{ type: "text", text: `${header}\n\n${dartCode}` }] };
        }

        case "flutterin_convert_web": {
          const { screenName, htmlContent } = args as { screenName: string; htmlContent: string };
          const rootNode = webConverter.parseHtml(htmlContent);
          const dartCode = codeGen.generateScreen(screenName, rootNode);
          const summary = summarizeConversion([{ name: screenName, root: rootNode }]);
          const header = formatFeasibilityHeader(summary);
          return { content: [{ type: "text", text: `${header}\n\n${dartCode}` }] };
        }

        case "flutterin_convert_react": {
          const { screenName, jsxContent } = args as { screenName: string; jsxContent: string };
          const rootNode = reactConverter.parseJsx(jsxContent);
          const dartCode = codeGen.generateScreen(screenName, rootNode);
          const summary = summarizeConversion([{ name: screenName, root: rootNode }]);
          const header = formatFeasibilityHeader(summary);
          return { content: [{ type: "text", text: `${header}\n\n${dartCode}` }] };
        }

        case "flutterin_convert_ios": {
          const { screenName, swiftUiContent } = args as { screenName: string; swiftUiContent: string };
          const rootNode = swiftUiConverter.parseSwiftUi(swiftUiContent);
          const dartCode = codeGen.generateScreen(screenName, rootNode);
          const summary = summarizeConversion([{ name: screenName, root: rootNode }]);
          const header = formatFeasibilityHeader(summary);
          return { content: [{ type: "text", text: `${header}\n\n${dartCode}` }] };
        }

        case "flutterin_generate_models": {
          const { modelName, jsonString, endpointUrl } = args as {
            modelName: string;
            jsonString: string;
            endpointUrl?: string;
          };
          const model = jsonConverter.parseJson(modelName, jsonString);
          const modelCode = codeGen.generateDataModel(model);
          const serviceCode = jsonConverter.generateDioService(
            modelName,
            endpointUrl || `https://api.example.com/${modelName.toLowerCase()}`
          );
          const combined = `${modelCode}\n// --- Dio API Service ---\n\n${serviceCode}`;
          return { content: [{ type: "text", text: combined }] };
        }

        case "flutterin_list_engines": {
          const { query } = (args || {}) as { query?: string };
          if (query) {
            const commitMatch = await EngineCatalog.findByCommit(query);
            const snapshotMatch = await EngineCatalog.findBySnapshotHash(query);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ query, commitMatch, snapshotMatch }, null, 2),
                },
              ],
            };
          }
          const all = await EngineCatalog.getAllEngines();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    totalCatalogCount: all.length,
                    sample: all.slice(0, 5),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "flutterin_generate_interceptor": {
          const { packageName, proxyHost, proxyPort } = args as {
            packageName: string;
            proxyHost?: string;
            proxyPort?: number;
          };
          const script = sslGenerator.generateFridaScript({
            packageName,
            proxyHost,
            proxyPort,
          });
          return { content: [{ type: "text", text: script }] };
        }

        case "flutterin_generate_context": {
          const { sourcePath, targetContextDir, allSlots, appName, profile } = args as {
            sourcePath: string;
            targetContextDir?: string;
            allSlots?: boolean;
            appName?: string;
            profile?: "utility" | "connected" | "saas" | "auto";
          };
          const generator = new ContextGenerator();
          const targetDir = targetContextDir || path.resolve(process.cwd(), "context");
          const result = await generator.generateAsync(sourcePath, targetDir, {
            allSlots: Boolean(allSlots),
            appName,
            profile,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        case "flutterin_reverse_flutter_to_context": {
          const { targetPath, targetContextDir, reflutterDumpPath, blutterDir, allSlots, appName, profile } = args as {
            targetPath: string;
            targetContextDir?: string;
            reflutterDumpPath?: string;
            blutterDir?: string;
            allSlots?: boolean;
            appName?: string;
            profile?: "utility" | "connected" | "saas" | "auto";
          };
          const generator = new ContextGenerator();
          const targetDir = targetContextDir || path.resolve(process.cwd(), "context");
          const result = await generator.generateAsync(targetPath, targetDir, {
            allSlots: Boolean(allSlots),
            appName,
            reflutterDumpPath,
            blutterDir,
            profile,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error executing ${name}: ${err?.message || String(err)}` }],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("flutterin MCP Server running on stdio");
}

if (process.argv[1]?.endsWith("mcp/index.js") || process.argv[1]?.endsWith("mcp\\index.js")) {
  startMcpServer().catch((err) => {
    console.error("Fatal error starting flutterin MCP server:", err);
    process.exit(1);
  });
}
