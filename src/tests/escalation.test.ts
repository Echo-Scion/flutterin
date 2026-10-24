import { describe, it } from "node:test";
import assert from "node:assert";
import { AndroidLayoutConverter } from "../targets/android/layoutConverter.js";
import { summarizeConversion, formatFeasibilityHeader } from "../ir/feasibility.js";

describe("4-Tier Conversion & Interactive Escalation Gate", () => {
  const converter = new AndroidLayoutConverter();

  it("should classify pure primitives as Tier 1 and SEAMLESS_VIBE_CODING", () => {
    const xml = `
      <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
          android:layout_width="match_parent"
          android:layout_height="match_parent"
          android:orientation="vertical">
          <TextView android:text="Hello" android:layout_width="wrap_content" android:layout_height="wrap_content" />
          <Button android:text="Click" android:layout_width="wrap_content" android:layout_height="wrap_content" />
      </LinearLayout>
    `;
    const rootNode = converter.parseXml(xml);
    const summary = summarizeConversion([{ name: "HomeScreen", root: rootNode }]);

    assert.strictEqual(summary.executionMode, "SEAMLESS_VIBE_CODING");
    assert.strictEqual(summary.tierCounts.tier1PureFlutter, 3); // Column, Text, ElevatedButton
    assert.strictEqual(summary.tierCounts.tier2EcosystemPlugins, 0);
    assert.strictEqual(summary.tierCounts.tier3HybridBridges, 0);
    assert.strictEqual(summary.tierCounts.tier4CustomBuildEscalations, 0);

    const header = formatFeasibilityHeader(summary);
    assert.ok(header.includes("executionMode=SEAMLESS_VIBE_CODING"));
    assert.ok(!header.includes("INTERACTIVE ESCALATION GATE"));
  });

  it("should classify WebView as Tier 2 with recommended package and SEAMLESS_VIBE_CODING", () => {
    const xml = `
      <LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
          android:layout_width="match_parent"
          android:layout_height="match_parent">
          <WebView android:id="@+id/webview" android:layout_width="match_parent" android:layout_height="match_parent" />
      </LinearLayout>
    `;
    const rootNode = converter.parseXml(xml);
    const summary = summarizeConversion([{ name: "WebScreen", root: rootNode }]);

    assert.strictEqual(summary.executionMode, "SEAMLESS_VIBE_CODING");
    assert.strictEqual(summary.tierCounts.tier2EcosystemPlugins, 1);
    assert.ok(summary.recommendedPackages.includes("webview_flutter"));
  });

  it("should classify SurfaceView as Tier 3 and trigger INTERACTIVE_ESCALATION_REQUIRED", () => {
    const xml = `
      <FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
          android:layout_width="match_parent"
          android:layout_height="match_parent">
          <SurfaceView android:id="@+id/surface" android:layout_width="match_parent" android:layout_height="match_parent" />
      </FrameLayout>
    `;
    const rootNode = converter.parseXml(xml);
    const summary = summarizeConversion([{ name: "VideoSurfaceScreen", root: rootNode }]);

    assert.strictEqual(summary.executionMode, "INTERACTIVE_ESCALATION_REQUIRED");
    assert.strictEqual(summary.tierCounts.tier3HybridBridges, 1);
    assert.strictEqual(summary.escalations.length, 1);
    assert.strictEqual(summary.escalations[0].recommendedTier, "HYBRID_BRIDGE");
    assert.strictEqual(summary.escalations[0].requiresUserConfirmation, true);
    assert.ok(summary.escalations[0].options.length >= 2);

    const header = formatFeasibilityHeader(summary);
    assert.ok(header.includes("executionMode=INTERACTIVE_ESCALATION_REQUIRED"));
    assert.ok(header.includes("INTERACTIVE ESCALATION GATE"));
  });

  it("should classify GLSurfaceView as Tier 4 and trigger INTERACTIVE_ESCALATION_REQUIRED", () => {
    const xml = `
      <FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
          android:layout_width="match_parent"
          android:layout_height="match_parent">
          <GLSurfaceView android:id="@+id/gl_surface" android:layout_width="match_parent" android:layout_height="match_parent" />
      </FrameLayout>
    `;
    const rootNode = converter.parseXml(xml);
    const summary = summarizeConversion([{ name: "GlScreen", root: rootNode }]);

    assert.strictEqual(summary.executionMode, "INTERACTIVE_ESCALATION_REQUIRED");
    assert.strictEqual(summary.tierCounts.tier4CustomBuildEscalations, 1);
    assert.strictEqual(summary.escalations[0].recommendedTier, "CUSTOM_BUILD_FROM_SCRATCH");
  });
});
