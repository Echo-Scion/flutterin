import { describe, it } from "node:test";
import assert from "node:assert";
import { AxmlParser } from "../core/decoders/axmlParser.js";
import { AsarUnpacker } from "../core/decoders/asarUnpacker.js";
import { SourceMapReconstructor, type SourceMapV3 } from "../core/decoders/sourceMapReconstructor.js";
import { HarSqliteInspector } from "../core/decoders/harSqliteInspector.js";
import { NativeBinaryReader } from "../core/decoders/nativeBinaryReader.js";
import { runPythonScript } from "../core/bridges/pythonRunner.js";
import { AndroidLayoutConverter } from "../targets/android/layoutConverter.js";
import { JsonModelConverter } from "../targets/api/jsonModelConverter.js";
import { FlutterCodeGenerator } from "../generators/flutterCodeGenerator.js";
import { ReactNativeConverter } from "../targets/react/reactNativeConverter.js";
import { IdentitySanitizer } from "../core/identitySanitizer.js";
import { MechanicalGuard } from "../core/mechanicalGuard.js";

describe("AxmlParser & Android Layout Converter", () => {
  it("should detect non-AXML buffer", () => {
    const invalidBuf = Buffer.from("<LinearLayout />", "utf8");
    const parser = new AxmlParser(invalidBuf);
    assert.strictEqual(parser.isAxml(), false);
  });

  it("should convert plain XML layout into Flutter Widget hierarchy", () => {
    const xml = `
      <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
          android:layout_width="match_parent"
          android:layout_height="match_parent"
          android:orientation="vertical"
          android:padding="16dp">
          <TextView
              android:layout_width="wrap_content"
              android:layout_height="wrap_content"
              android:text="Welcome to Flutterin"
              android:textSize="20sp"
              android:textStyle="bold" />
          <Button
              android:layout_width="match_parent"
              android:layout_height="wrap_content"
              android:text="Get Started" />
      </LinearLayout>
    `;

    const converter = new AndroidLayoutConverter();
    const rootNode = converter.parseXml(xml);
    assert.strictEqual(rootNode.type, "Column");
    assert.strictEqual(rootNode.children.length, 2);
    assert.strictEqual(rootNode.children[0].type, "Text");
    assert.strictEqual(rootNode.children[0].properties.text, "Welcome to Flutterin");
    assert.strictEqual(rootNode.children[1].type, "ElevatedButton");

    const codeGen = new FlutterCodeGenerator();
    const dartCode = codeGen.generateScreen("WelcomeScreen", rootNode);
    assert.ok(dartCode.includes("class WelcomeScreen extends StatelessWidget"));
    assert.ok(dartCode.includes("Column("));
    assert.ok(dartCode.includes("ElevatedButton("));
  });
});

describe("AsarUnpacker", () => {
  it("should correctly validate and unpack an ASAR archive buffer", () => {
    // Construct a minimal valid Pickle ASAR buffer
    // Pickle format: [uint32: 4, uint32: payload_size, uint32: header_size, uint32: json_len, ...json, ...payload]
    const manifest = {
      files: {
        "package.json": { size: 17, offset: "0" },
        "main.js": { size: 25, offset: "17" },
      },
    };
    const jsonStr = JSON.stringify(manifest);
    const jsonBuffer = Buffer.from(jsonStr, "utf8");
    const jsonLen = jsonBuffer.length;

    const payloadData = Buffer.concat([
      Buffer.from('{"name":"my-app"}', "utf8"), // 17 bytes
      Buffer.from('console.log("hello app");', "utf8"), // 24 bytes
    ]);

    // In Electron ASAR (Pickle format):
    // payload starts at offset 8, and contains [uint32: headerSize, uint32: jsonLen, jsonString...]
    // so picklePayloadSize = 8 + jsonLen
    const picklePayloadSize = 8 + jsonLen;
    const headerSize = jsonLen + 4;

    const header = Buffer.alloc(16);
    header.writeUInt32LE(4, 0);
    header.writeUInt32LE(picklePayloadSize, 4);
    header.writeUInt32LE(headerSize, 8);
    header.writeUInt32LE(jsonLen, 12);

    const asarBuffer = Buffer.concat([header, jsonBuffer, payloadData]);

    assert.strictEqual(AsarUnpacker.isAsar(asarBuffer), true);

    const unpacker = new AsarUnpacker(asarBuffer);
    const entries = unpacker.listEntries();
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].path, "package.json");
    assert.strictEqual(entries[1].path, "main.js");

    const pkgContent = unpacker.readFile("package.json").toString("utf8");
    assert.strictEqual(pkgContent, '{"name":"my-app"}');

    const jsContent = unpacker.readFile("main.js").toString("utf8");
    assert.strictEqual(jsContent, 'console.log("hello app");');
  });
});

describe("SourceMapReconstructor", () => {
  it("should reconstruct original files and detect frameworks", () => {
    const mockMap: SourceMapV3 = {
      version: 3,
      sources: ["webpack:///src/components/Header.tsx", "webpack:///src/utils/math.ts"],
      sourcesContent: [
        `import React, { useState } from 'react';
export const Header = () => {
  const [count, setCount] = useState(0);
  return <header><h1>Count: {count}</h1></header>;
};`,
        `export function add(a: number, b: number): number { return a + b; }`,
      ],
      mappings: "",
    };

    const result = SourceMapReconstructor.reconstruct(mockMap);
    assert.strictEqual(result.totalFiles, 2);
    assert.strictEqual(result.files[0].relativePath, "src/components/Header.tsx");
    assert.strictEqual(result.files[0].frameworkDetected, "React");
    assert.strictEqual(result.files[1].relativePath, "src/utils/math.ts");
    assert.strictEqual(result.files[1].frameworkDetected, "TypeScript");
    assert.ok(result.detectedFrameworks.includes("React"));
  });

  it("should extract embedded base64 source map from code", () => {
    const rawMap: SourceMapV3 = {
      version: 3,
      sources: ["app.ts"],
      sourcesContent: ["console.log('test');"],
      mappings: "",
    };
    const b64 = Buffer.from(JSON.stringify(rawMap)).toString("base64");
    const code = `console.log("compiled");\n//# sourceMappingURL=data:application/json;base64,${b64}`;

    const extracted = SourceMapReconstructor.extractEmbeddedSourceMap(code);
    assert.notStrictEqual(extracted, null);
    assert.strictEqual(extracted?.version, 3);
    assert.strictEqual(extracted?.sources[0], "app.ts");
  });
});

describe("HarSqliteInspector", () => {
  it("should parse HAR entries into API endpoints and models", () => {
    const mockHar = {
      log: {
        entries: [
          {
            request: {
              method: "GET",
              url: "https://api.example.com/v1/user-profiles?limit=10",
              queryString: [{ name: "limit", value: "10" }],
              headers: [{ name: "Authorization", value: "Bearer token123" }],
            },
            response: {
              status: 200,
              content: {
                mimeType: "application/json",
                text: JSON.stringify({
                  id: "usr_1",
                  name: "John Doe",
                  email: "john@example.com",
                  isActive: true,
                }),
              },
            },
          },
        ],
      },
    };

    const result = HarSqliteInspector.parseHar(mockHar);
    assert.strictEqual(result.totalEntries, 1);
    assert.strictEqual(result.endpoints.length, 1);
    assert.strictEqual(result.endpoints[0].method, "GET");
    assert.strictEqual(result.endpoints[0].path, "/v1/user-profiles");
    assert.strictEqual(result.endpoints[0].headers["Authorization"], "Bearer token123");
    assert.strictEqual(result.endpoints[0].inferredModelName, "UserProfile");

    assert.strictEqual(result.models.length, 1);
    const model = result.models[0];
    assert.strictEqual(model.name, "UserProfile");
    const nameField = model.fields.find((f) => f.name === "name");
    assert.strictEqual(nameField?.dartType, "String");
  });
});

describe("NativeBinaryReader", () => {
  it("should recognize ELF headers and produce Dart FFI wrappers", () => {
    // Construct minimal ELF header
    const elfBuf = Buffer.alloc(64);
    elfBuf[0] = 0x7f;
    elfBuf[1] = 0x45; // 'E'
    elfBuf[2] = 0x4c; // 'L'
    elfBuf[3] = 0x46; // 'F'
    elfBuf[4] = 2; // 64-bit
    elfBuf[5] = 1; // Little-endian
    elfBuf.writeUInt16LE(183, 18); // ARM64

    const reader = new NativeBinaryReader(elfBuf);
    const analysis = reader.analyze();
    assert.strictEqual(analysis.format, "ELF");
    assert.strictEqual(analysis.is64Bit, true);
    assert.ok(analysis.arch.includes("ARM64"));
  });

  it("should recognize WebAssembly magic header", () => {
    // WebAssembly magic: \0asm followed by version 1
    const wasmBuf = Buffer.alloc(16);
    wasmBuf[0] = 0x00;
    wasmBuf[1] = 0x61; // 'a'
    wasmBuf[2] = 0x73; // 's'
    wasmBuf[3] = 0x6d; // 'm'
    wasmBuf.writeUInt32LE(1, 4); // version 1

    const reader = new NativeBinaryReader(wasmBuf);
    const analysis = reader.analyze();
    assert.strictEqual(analysis.format, "WASM");
    assert.strictEqual(analysis.arch, "WebAssembly");
  });
});

describe("Cross-Platform Python Runner", () => {
  it("should execute multiline python code with argv arguments without shell escaping errors", async () => {
    const pyScript = `
import sys, json
arg1 = sys.argv[1]
print(json.dumps({"received": arg1, "ok": True}))
`;
    const stdout = await runPythonScript(pyScript, ["test-payload-with-spaces and \\path"]);
    const res = JSON.parse(stdout);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.received, "test-payload-with-spaces and \\path");
  });
});

describe("Master Audit Enhancements: Snake_Case, Riverpod & FFI Loader", () => {
  it("should normalize identifiers into idiomatic snake_case and PascalCase", () => {
    assert.strictEqual(FlutterCodeGenerator.toSnakeCase("UserProfile"), "user_profile");
    assert.strictEqual(FlutterCodeGenerator.toSnakeCase("orderItemDetail"), "order_item_detail");
    assert.strictEqual(FlutterCodeGenerator.toSnakeCase("APIResponse-Data"), "api_response_data");
    assert.strictEqual(FlutterCodeGenerator.toPascalCase("user_profile"), "UserProfile");
  });

  it("should generate Riverpod ConsumerWidget when requested", () => {
    const codeGen = new FlutterCodeGenerator();
    const dartCode = codeGen.generateScreen(
      "DashboardView",
      { type: "Text", properties: { text: "Dashboard" }, children: [] },
      { stateTarget: "riverpod" }
    );
    assert.ok(dartCode.includes("import 'package:flutter_riverpod/flutter_riverpod.dart';"));
    assert.ok(dartCode.includes("class DashboardView extends ConsumerWidget"));
    assert.ok(dartCode.includes("Widget build(BuildContext context, WidgetRef ref)"));
  });

  it("should generate snake_case import paths in Dio service client", () => {
    const converter = new JsonModelConverter();
    const serviceCode = converter.generateDioService("UserProfile", "https://api.example.com/users");
    assert.ok(serviceCode.includes("import '../models/user_profile.dart';"));
    assert.ok(serviceCode.includes("class UserProfileService"));
  });

  it("should generate cross-platform dynamic library resolver in FFI bindings", () => {
    const elfBuf = Buffer.alloc(128);
    elfBuf[0] = 0x7f;
    elfBuf[1] = 0x45;
    elfBuf[2] = 0x4c;
    elfBuf[3] = 0x46;
    elfBuf[4] = 2;
    elfBuf[5] = 1;
    elfBuf.writeUInt16LE(183, 18);
    // write a symbol
    elfBuf.write("Java_com_example_crypto_init", 40, "latin1");

    const reader = new NativeBinaryReader(elfBuf);
    const analysis = reader.analyze();
    assert.ok(analysis.dartFfiWrapperCode);
    assert.ok(analysis.dartFfiWrapperCode.includes("Platform.isWindows"));
    assert.ok(analysis.dartFfiWrapperCode.includes("native_lib.dll"));
    assert.ok(analysis.dartFfiWrapperCode.includes("libnative_lib.dylib"));
    assert.ok(analysis.dartFfiWrapperCode.includes("libnative_lib.so"));
  });
});

describe("Adversarial Patch Verification Tests", () => {
  it("AxmlParser should correctly decode fractional dp dimensions with non-zero radix", () => {
    const parser = new AxmlParser(Buffer.alloc(8));
    // Radix = 1 (16p7), mantissa = 165 -> 165 / 128 = 1.2890625 -> 1.29dp
    const formatted = (parser as any).formatTypedValue(0x05, (165 << 8) | (1 << 4) | 1);
    assert.strictEqual(formatted, "1.29dp");
  });

  it("HarSqliteInspector should sanitize reserved word column names in Dart code", () => {
    const mockTables = [
      {
        tableName: "orders",
        sql: "",
        rowCount: 1,
        sampleRows: [],
        columns: [
          { cid: 0, name: "default", type: "TEXT", notNull: true, defaultValue: null, isPrimaryKey: false },
          { cid: 1, name: "1st_item", type: "INT", notNull: false, defaultValue: null, isPrimaryKey: false },
        ],
      },
    ];
    const dartEntities = (HarSqliteInspector as any).generateDartEntities(mockTables);
    assert.ok(dartEntities.includes("final String defaultCol;"));
    assert.ok(dartEntities.includes("final int? c1stItem;"));
  });

  it("ReactNativeConverter should extract image uri from double-brace source prop", () => {
    const converter = new ReactNativeConverter();
    const node = converter.parseJsx('<Image source={{uri: "https://example.com/logo.png"}} />');
    assert.strictEqual(node.properties.src, "https://example.com/logo.png");
  });

  it("FlutterCodeGenerator should sanitize SF Symbol dots in icon names", () => {
    const codeGen = new FlutterCodeGenerator();
    const screen = codeGen.generateScreen("TestScreen", {
      type: "Icon",
      properties: { iconName: "arrow.right.circle.fill" },
      children: [],
    });
    assert.ok(screen.includes("Icons.arrow_right_circle_fill"));
  });
});

describe("4-Tier Near-100% Conversion & Interactive Escalation Verification", () => {
  it("ReactNativeConverter should preserve multi-property inline style and direct return JSX", () => {
    const converter = new ReactNativeConverter();
    const jsx = `
      export const CardBanner = () =>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2563EB', borderRadius: 12, padding: 16 }}>
          <Text>Promo Active</Text>
          <Canvas />
        </View>;
    `;
    const root = converter.parseJsx(jsx);
    assert.strictEqual(root.type, "Row");
    assert.strictEqual(root.properties.alignment, "spaceBetween");
    assert.strictEqual(root.properties.backgroundColor, "2563EB");
    assert.strictEqual(root.properties.borderRadius, 12);

    const codeGen = new FlutterCodeGenerator();
    const dartCode = codeGen.generateScreen("PromoBannerScreen", root);
    assert.ok(dartCode.includes("BoxDecoration("), "Row with backgroundColor/borderRadius must emit BoxDecoration");
    assert.ok(dartCode.includes("Color(0xFF2563EB)"), "Must preserve hex background color");
    assert.ok(dartCode.includes("[TIER 4 INTERACTIVE ESCALATION - USER CONFIRMATION REQUIRED]"), "Must surface Tier 4 escalation banner for <Canvas>");
  });

  it("FlutterCodeGenerator should auto-import flutter/services.dart and flutter/foundation.dart for PlatformViews", () => {
    const codeGen = new FlutterCodeGenerator();
    const screenCode = codeGen.generateScreen("MapContainerScreen", {
      type: "Container",
      rawSourceType: "MapView",
      properties: {},
      children: [],
    });
    assert.ok(screenCode.includes("import 'package:flutter/services.dart';"));
    assert.ok(screenCode.includes("import 'package:flutter/foundation.dart';"));
    assert.ok(screenCode.includes("if (kIsWeb)"));
    assert.ok(screenCode.includes("StandardMessageCodec()"));
  });

  it("IdentitySanitizer should never corrupt Dart Widget class names when APK name contains 'text' or 'card'", () => {
    const identity = IdentitySanitizer.resolveIdentity({
      userAppName: "MyBrandApp",
      sourceArtifactPath: "/tmp/text_card_viewer.apk",
    });
    const sampleCode = `import 'package:flutter/material.dart';\nconst w = Text('Welcome to text_card_viewer');`;
    const sanitized = IdentitySanitizer.sanitizeCodeAndStrings(sampleCode, identity);
    assert.ok(sanitized.includes("const w = Text("), "Must NOT replace Dart 'Text(' constructor with appName!");
  });

  it("MechanicalGuard.detectEcosystemMode correctly identifies standalone mode vs .agents synergy", () => {
    const standaloneEnv = MechanicalGuard.detectEcosystemMode("C:/non_existent_standalone_dir_12345");
    assert.strictEqual(standaloneEnv.mode, "standalone");
    assert.strictEqual(standaloneEnv.hasOrionScript, false);

    const synergyEnv = MechanicalGuard.detectEcosystemMode(process.cwd());
    assert.strictEqual(synergyEnv.mode, "agents_synergy");
    assert.strictEqual(synergyEnv.hasOrionScript, true);
  });
});


