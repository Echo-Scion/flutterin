import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ContextGenerator, type ExtractedSignals } from "../generators/contextGenerator.js";

test("ContextGenerator extracts AndroidManifest signals correctly", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flutterin-ctx-test-"));
  try {
    const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.quickball"
    android:versionName="1.4.2"
    android:versionCode="42">
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <application android:label="QuickBall">
        <activity android:name=".MainActivity" />
        <activity android:name=".SettingsActivity" />
    </application>
</manifest>`;
    fs.writeFileSync(path.join(tmpDir, "AndroidManifest.xml"), manifestXml, "utf8");

    const generator = new ContextGenerator();
    const signals = generator.scanSource(tmpDir);

    assert.strictEqual(signals.packageName, "com.example.quickball");
    assert.strictEqual(signals.version, "1.4.2");
    assert.ok(signals.permissions.includes("android.permission.SYSTEM_ALERT_WINDOW"));
    assert.ok(signals.permissions.includes("android.permission.VIBRATE"));
    assert.ok(signals.activities.includes("MainActivity"));
    assert.ok(signals.activities.includes("SettingsActivity"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("ContextGenerator synthesizes Master documents and selective detail files", () => {
  const generator = new ContextGenerator();
  const mockSignals: ExtractedSignals = {
    appName: "TestApp",
    packageName: "com.test.app",
    version: "2.0.0",
    permissions: ["android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE"],
    activities: ["HomeActivity", "DetailActivity"],
    colors: { primary: "#6200EE", secondary: "#03DAC6" },
    sqliteTables: [{ name: "user_cache", columns: ["id", "username"], rowCount: 15 }],
    apiEndpoints: [{ method: "GET", path: "/api/v1/users", modelName: "UserModel" }],
    detectedSdks: [{ name: "In-App Billing", category: "billing", fileSource: "build.gradle" }],
    sourceArtifacts: ["AndroidManifest.xml", "colors.xml", "database.sqlite"],
  };

  const specs = generator.synthesizeContextFiles(mockSignals, { allSlots: false });
  const relativePaths = specs.map((s) => s.relativePath);

  // Must include the 4 Lean Masters
  assert.ok(relativePaths.includes("00_Strategy/BLUEPRINT.md"));
  assert.ok(relativePaths.includes("01_Product/ROADMAP.md"));
  assert.ok(relativePaths.includes("02_Creative/STYLE_GUIDE.md"));
  assert.ok(relativePaths.includes("03_Tech/ARCHITECTURE.md"));

  // Must include signal-backed children
  assert.ok(relativePaths.includes("03_Tech/Infra_Security.md"), "Must include Infra_Security for permissions");
  assert.ok(relativePaths.includes("03_Tech/Dev_Database.md"), "Must include Dev_Database for sqlite");
  assert.ok(relativePaths.includes("03_Tech/Dev_APIs.md"), "Must include Dev_APIs for endpoints");
  assert.ok(relativePaths.includes("02_Creative/Design_Design_System.md"), "Must include Design_System for colors");
  assert.ok(relativePaths.includes("02_Creative/Design_UX_Flows.md"), "Must include UX_Flows for activities");
  assert.ok(relativePaths.includes("01_Product/Conv_Pricing_Strategy.md"), "Must include Conv_Pricing_Strategy for billing SDK");

  // Verify Epistemic Confidence Tagging
  const secSpec = specs.find((s) => s.relativePath === "03_Tech/Infra_Security.md");
  assert.strictEqual(secSpec?.epistemicStatus, "AST_VERIFIED");
  assert.strictEqual(secSpec?.needsHumanReview, false);

  const dbSpec = specs.find((s) => s.relativePath === "03_Tech/Dev_Database.md");
  assert.strictEqual(dbSpec?.epistemicStatus, "AST_VERIFIED");
  assert.strictEqual(dbSpec?.needsHumanReview, false);

  const billingSpec = specs.find((s) => s.relativePath === "01_Product/Conv_Pricing_Strategy.md");
  assert.strictEqual(billingSpec?.epistemicStatus, "SDK_INFERRED");
  assert.strictEqual(billingSpec?.needsHumanReview, true);

  const roadmapSpec = specs.find((s) => s.relativePath === "01_Product/ROADMAP.md");
  assert.strictEqual(roadmapSpec?.epistemicStatus, "HYPOTHESIS_DRAFT");
  assert.strictEqual(roadmapSpec?.needsHumanReview, true);
});

test("ContextGenerator preserves manual developer modifications across re-scans via bounded anchors", () => {
  const tmpContextDir = fs.mkdtempSync(path.join(os.tmpdir(), "flutterin-merge-test-"));
  try {
    const generator = new ContextGenerator();
    const filePath = path.join(tmpContextDir, "03_Tech/Infra_Security.md");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    // Initial manual document
    const initialText = `---
title: "Security Spec"
epistemic_status: AST_VERIFIED
source_artifacts: ["AndroidManifest.xml"]
needs_human_review: false
---

# Infrastructure Security

<!-- [FLUTTERIN:AUTO-INFERRED:START source="AndroidManifest.xml" confidence="AST_VERIFIED"] -->
## Declared Permissions
- android.permission.INTERNET
<!-- [FLUTTERIN:AUTO-INFERRED:END] -->

## Manual Architecture & Business Decisions
- CRITICAL: We enforce mTLS certificates on all network calls.
- DEVELOPER NOTE: Token refresh timeout is 15 minutes.
`;
    fs.writeFileSync(filePath, initialText, "utf8");

    // Re-scan with updated permissions
    const updatedSignals: ExtractedSignals = {
      appName: "SecureApp",
      permissions: ["android.permission.INTERNET", "android.permission.CAMERA", "android.permission.BIOMETRIC"],
      activities: [],
      colors: {},
      sqliteTables: [],
      apiEndpoints: [],
      detectedSdks: [],
      sourceArtifacts: ["AndroidManifest.xml"],
    };

    const fileSpec = {
      relativePath: "03_Tech/Infra_Security.md",
      title: "Infrastructure & Security Specifications",
      pillar: "03_Tech" as const,
      epistemicStatus: "AST_VERIFIED" as const,
      needsHumanReview: false,
      content: generator["generateSecurityContent"](updatedSignals),
    };

    const action = generator.writeOrMergeFile(filePath, fileSpec, updatedSignals);
    assert.strictEqual(action, "updated");

    const contentAfter = fs.readFileSync(filePath, "utf8");

    // Verified: Bounded section was updated with new permissions
    assert.ok(contentAfter.includes("android.permission.CAMERA"));
    assert.ok(contentAfter.includes("android.permission.BIOMETRIC"));

    // Verified: Manual developer notes outside anchor were 100% PRESERVED!
    assert.ok(contentAfter.includes("CRITICAL: We enforce mTLS certificates on all network calls."));
    assert.ok(contentAfter.includes("DEVELOPER NOTE: Token refresh timeout is 15 minutes."));
  } finally {
    fs.rmSync(tmpContextDir, { recursive: true, force: true });
  }
});
