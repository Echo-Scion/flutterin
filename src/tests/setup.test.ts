import { test } from "node:test";
import * as assert from "node:assert";
import { PROFILE_DEFINITIONS, KNOWN_TOOLS, type FlutterinProfile } from "../tools/profiles.js";
import { FlutterinDoctor } from "../tools/doctor.js";
import { FlutterinSetup } from "../tools/setup.js";

test("Profile definitions contain valid and distinct tools", () => {
  const profiles: FlutterinProfile[] = ["web-ui", "mobile", "native", "full"];

  for (const p of profiles) {
    const def = PROFILE_DEFINITIONS[p];
    assert.ok(def, `Profile ${p} must exist in PROFILE_DEFINITIONS`);
    assert.ok(def.name.length > 0, `Profile ${p} must have a name`);
    assert.ok(def.toolIds.length > 0, `Profile ${p} must define at least one tool`);

    for (const toolId of def.toolIds) {
      assert.ok(KNOWN_TOOLS[toolId], `Tool '${toolId}' referenced by profile '${p}' must exist in KNOWN_TOOLS`);
    }
  }
});

test("web-ui profile requires zero external binary tools", () => {
  const webUi = PROFILE_DEFINITIONS["web-ui"];
  assert.strictEqual(webUi.zeroExternalDeps, true);

  // Tools in web-ui should only be standard runtimes (node, python, flutter, dart)
  const allowed = new Set(["node", "python", "flutter", "dart"]);
  for (const t of webUi.toolIds) {
    assert.ok(allowed.has(t), `web-ui profile should not require binary decompiler tool '${t}'`);
  }
});

test("FlutterinDoctor scopes checkAll to requested profile", async () => {
  const doctor = new FlutterinDoctor();
  const webUiReport = await doctor.checkAll("web-ui");

  assert.strictEqual(webUiReport.activeProfile, "web-ui");
  assert.ok(webUiReport.profileName?.includes("Web & UI"));

  // Check that Mobile/Native tools like JADX and Rizin are excluded from web-ui report
  const allCheckedTools = Object.values(webUiReport.pillars).flat().map((t) => t.tool);
  assert.ok(!allCheckedTools.includes("jadx"), "web-ui doctor report must not include JADX");
  assert.ok(!allCheckedTools.includes("rizin"), "web-ui doctor report must not include Rizin");
  assert.ok(!allCheckedTools.includes("wabt"), "web-ui doctor report must not include WABT");
  assert.ok(allCheckedTools.includes("node"), "web-ui doctor report must include Node");
});

test("FlutterinSetup analyzes web-ui profile cleanly", async () => {
  const analysis = await FlutterinSetup.analyzeProfile("web-ui");

  assert.strictEqual(analysis.profile, "web-ui");
  assert.strictEqual(analysis.zeroExternalDeps, true);
  assert.ok(analysis.packageManagers.length >= 0);
  assert.ok(analysis.installedTools.some((t) => t.tool.id === "node"));
});

test("FlutterinSetup resolves install command for tools dynamically", async () => {
  const jadxCmd = await FlutterinSetup.getInstallCommandForTool("jadx");
  assert.ok(jadxCmd, "Must resolve install command for jadx");
  assert.ok(jadxCmd.includes("jadx"), `Install command should reference jadx, got: ${jadxCmd}`);

  const unknown = await FlutterinSetup.getInstallCommandForTool("nonexistent_tool_123");
  assert.strictEqual(unknown, undefined);
});

test("FlutterinSetup.autoFix handles empty commands cleanly without throwing", async () => {
  const fakeAnalysis: any = {
    profile: "web-ui",
    profileName: "Web & UI Transpiler",
    recommendedCommands: [],
  };
  await assert.doesNotReject(async () => {
    await FlutterinSetup.autoFix(fakeAnalysis);
  });
});
