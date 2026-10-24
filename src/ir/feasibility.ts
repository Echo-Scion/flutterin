/**
 * Conversion feasibility summary: decides between seamless generation and
 * an interactive decision gate, based only on IR tier metadata.
 */

import type { InteractiveEscalationSpec, WidgetNode } from "./types.js";

export type ExecutionMode = "SEAMLESS_VIBE_CODING" | "INTERACTIVE_ESCALATION_REQUIRED";

export interface ConversionFeasibilitySummary {
  executionMode: ExecutionMode;
  tierCounts: {
    tier1PureFlutter: number;
    tier2EcosystemPlugins: number;
    tier3HybridBridges: number;
    tier4CustomBuildEscalations: number;
  };
  recommendedPackages: string[];
  escalations: InteractiveEscalationSpec[];
  /** Screens or components held back because they contain unresolved Tier 4 nodes. */
  deferredScreens: string[];
}

export function summarizeConversion(
  roots: { name: string; root: WidgetNode }[]
): ConversionFeasibilitySummary {
  const summary: ConversionFeasibilitySummary = {
    executionMode: "SEAMLESS_VIBE_CODING",
    tierCounts: {
      tier1PureFlutter: 0,
      tier2EcosystemPlugins: 0,
      tier3HybridBridges: 0,
      tier4CustomBuildEscalations: 0,
    },
    recommendedPackages: [],
    escalations: [],
    deferredScreens: [],
  };
  const packages = new Set<string>();

  for (const { name, root } of roots) {
    let blocked = false;
    const walk = (n: WidgetNode): void => {
      switch (n.conversionTier) {
        case "ECOSYSTEM_PLUGIN":
          summary.tierCounts.tier2EcosystemPlugins++;
          break;
        case "HYBRID_BRIDGE":
          summary.tierCounts.tier3HybridBridges++;
          break;
        case "CUSTOM_BUILD_FROM_SCRATCH":
          summary.tierCounts.tier4CustomBuildEscalations++;
          break;
        default:
          summary.tierCounts.tier1PureFlutter++;
      }
      n.recommendedPackages?.forEach((p) => packages.add(p));
      if (n.escalation) {
        summary.escalations.push(n.escalation);
        if (n.escalation.requiresUserConfirmation) blocked = true;
      }
      n.children.forEach(walk);
    };
    walk(root);
    if (blocked) summary.deferredScreens.push(name);
  }

  summary.recommendedPackages = Array.from(packages);
  if (
    summary.tierCounts.tier3HybridBridges > 0 ||
    summary.tierCounts.tier4CustomBuildEscalations > 0 ||
    summary.escalations.some((e) => e.requiresUserConfirmation)
  ) {
    summary.executionMode = "INTERACTIVE_ESCALATION_REQUIRED";
  }
  return summary;
}

/** One-line header for tool output so a calling agent knows whether to ask the user. */
export function formatFeasibilityHeader(summary: ConversionFeasibilitySummary): string {
  const t = summary.tierCounts;
  const base = `// [FLUTTERIN executionMode=${summary.executionMode}] tier1=${t.tier1PureFlutter} tier2=${t.tier2EcosystemPlugins} tier3=${t.tier3HybridBridges} tier4=${t.tier4CustomBuildEscalations}`;
  if (summary.executionMode === "SEAMLESS_VIBE_CODING") return base;
  const ids = summary.escalations.map((e) => e.id).join(", ");
  return `${base}\n// [FLUTTERIN] 🛑 INTERACTIVE ESCALATION GATE: Requires user confirmation before coding.\n// [FLUTTERIN] Escalations pending: ${ids || 'Tier 3/4 platform bridge decision needed'}`;
}
