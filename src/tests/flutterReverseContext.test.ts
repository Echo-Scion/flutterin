import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as zlib from "node:zlib";
import { EngineCatalog } from "../targets/binary/engineCatalog.js";
import { AotSnapshotReader } from "../targets/binary/aotSnapshotReader.js";
import { FlutterAppAnalyzer } from "../targets/flutter/flutterAppAnalyzer.js";
import { ContextGenerator } from "../generators/contextGenerator.js";

test("EngineCatalog matches vanilla and Shorebird snapshot hashes", async () => {
  const all = await EngineCatalog.getAllEngines();
  assert.ok(all.length >= 730, `Expected at least 730 catalog entries, found ${all.length}`);

  // Test Shorebird entry (e.g. hash 8a2933559b33778f54d3f3e3ddf01b8a)
  const shorebirdEngine = await EngineCatalog.findBySnapshotHash("8a2933559b33778f54d3f3e3ddf01b8a");
  assert.ok(shorebirdEngine, "Should find Shorebird engine by snapshot hash");
  assert.strictEqual(shorebirdEngine?.flavor, "shorebird");
  assert.ok(shorebirdEngine?.flutterVersion.includes("Shorebird"));
});

test("AotSnapshotReader extracts snapshot hash and VM flags", async () => {
  const reader = new AotSnapshotReader();

  // Create mock binary buffer containing snapshot marker and null-terminated flags
  const dummyHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const dummyFlags = "product compressed-pointers null-safety";
  const marker = "_kDartVmSnapshotData";

  const buf = Buffer.concat([
    Buffer.from("\x7fELF\x02\x01\x01\x00"), // ELF header
    Buffer.alloc(64),
    Buffer.from(marker),
    Buffer.alloc(24),
    Buffer.from(dummyHash),
    Buffer.from("\x00"),
    Buffer.from(dummyFlags),
    Buffer.from("\x00"),
  ]);

  const report = await reader.analyzeBuffer(buf, "mock_libapp.so");
  assert.strictEqual(report.isFlutterBinary, true);
  assert.strictEqual(report.snapshotHash, dummyHash);
  assert.ok(report.flags && report.flags.includes("product"));
  assert.ok(report.flags && report.flags.includes("null-safety"));
});

test("FlutterAppAnalyzer extracts packages from compressed NOTICES.Z, manifests, and pp.txt", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flutterin-analyzer-test-"));
  try {
    const assetsDir = path.join(tmpDir, "flutter_assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    // 1. Create compressed NOTICES.Z with mock licenses
    const noticeContent = `
================================================================================
package:dio
MIT License
Dio HTTP Client
================================================================================
package:flutter_riverpod
MIT License
Reactive State Management
================================================================================
package:sqflite
BSD License
SQLite plugin
================================================================================
package:in_app_purchase
BSD License
In-App Purchases
`;
    const compressed = zlib.deflateSync(Buffer.from(noticeContent, "utf-8"));
    fs.writeFileSync(path.join(assetsDir, "NOTICES.Z"), compressed);

    // 2. Create AssetManifest.json and FontManifest.json
    fs.writeFileSync(path.join(assetsDir, "AssetManifest.json"), JSON.stringify({
      "assets/images/logo.png": ["assets/images/logo.png"],
      "assets/icons/cart.svg": ["assets/icons/cart.svg"],
    }));
    fs.writeFileSync(path.join(assetsDir, "FontManifest.json"), JSON.stringify([
      { family: "Inter", fonts: [{ asset: "fonts/Inter-Regular.ttf" }] },
    ]));

    // 3. Create mock blutter pp.txt (Object Pool strings)
    const ppContent = `
pp[0x10] = "https://api.store.example.com/v1/checkout"
pp[0x18] = "https://api.store.example.com/v1/auth/login"
pp[0x20] = "CREATE TABLE IF NOT EXISTS cart_items (id INTEGER PRIMARY KEY, sku TEXT)"
pp[0x28] = "CREATE TABLE IF NOT EXISTS user_session (token TEXT, expiry INTEGER)"
pp[0x30] = "app_auth_token"
pp[0x38] = "selected_theme_mode"
`;
    fs.writeFileSync(path.join(tmpDir, "pp.txt"), ppContent, "utf-8");

    // 4. Create mock reFlutter dump.dart JSONL
    const dumpLines = [
      JSON.stringify({ class: "LoginScreen", library: "package:app/features/auth/login_screen.dart", super: "StatefulWidget", methods: ["build", "handleLogin"], fields: ["usernameController"] }),
      JSON.stringify({ class: "CheckoutScreen", library: "package:app/features/checkout/checkout_screen.dart", super: "ConsumerWidget", methods: ["build", "processPayment"], fields: ["cartProvider"] }),
      JSON.stringify({ class: "OrderController", library: "package:app/features/checkout/order_controller.dart", super: "StateNotifier", methods: ["placeOrder"], fields: ["state"] }),
      JSON.stringify({ class: "CartItemModel", library: "package:app/models/cart_item.dart", super: "Object", methods: ["fromJson", "toJson"], fields: ["id", "sku", "price"] }),
    ].join("\n");
    fs.writeFileSync(path.join(tmpDir, "dump.dart"), dumpLines, "utf-8");

    const analyzer = new FlutterAppAnalyzer();
    const analysis = await analyzer.analyzeTarget(tmpDir, {
      reflutterDumpPath: path.join(tmpDir, "dump.dart"),
      blutterDirPath: tmpDir,
    });

    assert.strictEqual(analysis.isFlutterApp, true);
    assert.ok(analysis.pubPackages.some((p) => p.name === "dio" && p.category === "networking"));
    assert.ok(analysis.pubPackages.some((p) => p.name === "flutter_riverpod" && p.category === "state_management"));
    assert.ok(analysis.pubPackages.some((p) => p.name === "sqflite" && p.category === "storage"));
    assert.ok(analysis.pubPackages.some((p) => p.name === "in_app_purchase" && p.category === "billing"));

    // State management detection
    assert.ok(analysis.stateManagement.includes("Riverpod"));

    // Screen detection
    assert.ok(analysis.discoveredScreens.includes("LoginScreen"));
    assert.ok(analysis.discoveredScreens.includes("CheckoutScreen"));

    // Endpoints detection from pp.txt
    assert.ok(analysis.discoveredEndpoints.some((e) => e.urlOrPath.includes("/checkout")));
    assert.ok(analysis.discoveredEndpoints.some((e) => e.urlOrPath.includes("/auth/login")));

    // Tables detection from pp.txt
    assert.ok(analysis.discoveredTables.includes("cart_items"));
    assert.ok(analysis.discoveredTables.includes("user_session"));

    // Storage keys detection
    assert.ok(analysis.storageKeys.includes("app_auth_token"));
    assert.ok(analysis.storageKeys.includes("selected_theme_mode"));

    // Font and asset detection
    assert.ok(analysis.fonts.includes("Inter"));
    assert.ok(analysis.assets.includes("assets/images/logo.png"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("ContextGenerator generates all 82 files + 5 masters (87 files) with non-destructive anchors", async () => {
  const tmpSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), "flutterin-src-test-"));
  const tmpContextDir = fs.mkdtempSync(path.join(os.tmpdir(), "flutterin-ctx-test-"));

  try {
    // Scaffold minimal Flutter indicators
    const assetsDir = path.join(tmpSrcDir, "flutter_assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    const noticeContent = `package:flutter_bloc\nMIT License\npackage:hive\nMIT License\npackage:purchases_flutter\nMIT License\n`;
    fs.writeFileSync(path.join(assetsDir, "NOTICES.Z"), zlib.deflateSync(Buffer.from(noticeContent, "utf-8")));
    fs.writeFileSync(path.join(tmpSrcDir, "pp.txt"), `pp[0x10] = "https://api.domain.io/v1/orders"\npp[0x20] = "CREATE TABLE user_cache (id INT)"\n`, "utf-8");

    const generator = new ContextGenerator();
    const result = await generator.generateAsync(tmpSrcDir, tmpContextDir, {
      allSlots: true,
      appName: "ECommerceApp",
    });

    // Verify 87 files total: 82 granular + 5 masters
    assert.strictEqual(result.filesWritten.length, 87, `Expected 87 files written, got ${result.filesWritten.length}`);

    // Verify the 5 Master files are present
    assert.ok(result.filesWritten.includes("00_Strategy/BLUEPRINT.md"));
    assert.ok(result.filesWritten.includes("00_Strategy/MEMORY.md"));
    assert.ok(result.filesWritten.includes("01_Product/ROADMAP.md"));
    assert.ok(result.filesWritten.includes("02_Creative/STYLE_GUIDE.md"));
    assert.ok(result.filesWritten.includes("03_Tech/ARCHITECTURE.md"));

    // Verify all 4 pillars have their files
    const strategyFiles = result.filesWritten.filter((f) => f.startsWith("00_Strategy/"));
    assert.strictEqual(strategyFiles.length, 17, `Expected 17 strategy files, got ${strategyFiles.length}`);

    const productFiles = result.filesWritten.filter((f) => f.startsWith("01_Product/"));
    assert.strictEqual(productFiles.length, 47, `Expected 47 product files, got ${productFiles.length}`);

    const creativeFiles = result.filesWritten.filter((f) => f.startsWith("02_Creative/"));
    assert.strictEqual(creativeFiles.length, 6, `Expected 6 creative files, got ${creativeFiles.length}`);

    const techFiles = result.filesWritten.filter((f) => f.startsWith("03_Tech/"));
    assert.strictEqual(techFiles.length, 17, `Expected 17 tech files, got ${techFiles.length}`);

    // Verify bounded anchors and frontmatter in sample file
    const samplePath = path.join(tmpContextDir, "03_Tech/Dev_Database.md");
    const sampleContent = fs.readFileSync(samplePath, "utf-8");
    assert.ok(sampleContent.includes("<!-- [FLUTTERIN:AUTO-INFERRED:START"));
    assert.ok(sampleContent.includes("<!-- [FLUTTERIN:AUTO-INFERRED:END] -->"));
    assert.ok(sampleContent.includes("user_cache"));
    assert.ok(sampleContent.includes("epistemic_status:"));

    // Add manual developer note outside anchor
    const customNote = "### ARCHITECTURE NOTE\n- We must keep sqlite encryption key in biometric hardware keychain.\n";
    fs.appendFileSync(samplePath, customNote, "utf-8");

    // Re-run generation (re-scan)
    const updateResult = await generator.generateAsync(tmpSrcDir, tmpContextDir, {
      allSlots: true,
      appName: "ECommerceApp",
    });

    assert.ok(updateResult.filesUpdated.includes("03_Tech/Dev_Database.md"));
    const updatedContent = fs.readFileSync(samplePath, "utf-8");

    // Verify custom note remains intact!
    assert.ok(updatedContent.includes("We must keep sqlite encryption key in biometric hardware keychain."));
    // Verify auto-inferred section remains intact
    assert.ok(updatedContent.includes("user_cache"));
  } finally {
    fs.rmSync(tmpSrcDir, { recursive: true, force: true });
    fs.rmSync(tmpContextDir, { recursive: true, force: true });
  }
});
