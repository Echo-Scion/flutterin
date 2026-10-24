/**
 * Shared builders for Tier 2 (ecosystem plugin), Tier 3 (hybrid bridge), and Tier 4 (custom build) IR metadata.
 * Keeps Android, iOS, and Web converters aligned with the escalation contract in ./types.ts.
 */

import type {
  ConversionStrategyTier,
  InteractiveEscalationSpec,
  WidgetNode,
} from "./types.js";

export type EscalationPlatform = InteractiveEscalationSpec["sourcePlatform"];

export interface TierMetadata {
  conversionTier: ConversionStrategyTier;
  recommendedPackages?: string[];
  escalation?: InteractiveEscalationSpec;
}

/** Tier 2: a native-only view that has a mature pub.dev package. */
export function ecosystemPluginMeta(packages: string[]): TierMetadata {
  return { conversionTier: "ECOSYSTEM_PLUGIN", recommendedPackages: packages };
}

/**
 * Tier 3: OS-level capabilities or native platform views that require a hybrid native bridge.
 * Requires user confirmation / interactive gate to choose bridge strategy.
 */
export function hybridBridgeEscalation(
  platform: EscalationPlatform,
  construct: string,
  reason: string,
  customOptions?: InteractiveEscalationSpec["options"]
): TierMetadata {
  const slug = construct.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return {
    conversionTier: "HYBRID_BRIDGE",
    escalation: {
      id: `esc_${platform}_bridge_${slug}`,
      sourceConstruct: construct,
      sourcePlatform: platform,
      reason,
      recommendedTier: "HYBRID_BRIDGE",
      estimatedEffort: "medium",
      requiresUserConfirmation: true,
      options: customOptions || [
        {
          optionId: "hybrid_native_bridge",
          label: `Generate MethodChannel & Kotlin/Swift host bridge for '${construct}'`,
          description: "Preserve 100% native OS integration via MethodChannel/EventChannel or PlatformView.",
        },
        {
          optionId: "ecosystem_alternative",
          label: `Check pub.dev for an existing community Flutter plugin for '${construct}'`,
          description: "Replace custom platform bridge with a verified community package.",
        },
        {
          optionId: "simplified_mock",
          label: `Generate Dart service stub / UI placeholder without native code`,
          description: "Keep Flutter layer clean and defer native implementation.",
        },
      ],
    },
  };
}

/**
 * Tier 4: heavy custom rendering that cannot be converted mechanically.
 * Always requires user confirmation before any 0-to-1 build.
 */
export function customBuildEscalation(
  platform: EscalationPlatform,
  construct: string,
  reason: string,
  nativeHostOption: { label: string; description: string }
): TierMetadata {
  const slug = construct.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return {
    conversionTier: "CUSTOM_BUILD_FROM_SCRATCH",
    escalation: {
      id: `esc_${platform}_${slug}`,
      sourceConstruct: construct,
      sourcePlatform: platform,
      reason,
      recommendedTier: "CUSTOM_BUILD_FROM_SCRATCH",
      estimatedEffort: "heavy_custom_build",
      requiresUserConfirmation: true,
      options: [
        {
          optionId: "pure_flutter_custom",
          label: `Rebuild '${construct}' with Flutter CustomPainter / FragmentShader`,
          description: "Port the drawing or shader logic into Dart. Highest effort, fully portable.",
        },
        {
          optionId: "hybrid_native_bridge",
          label: nativeHostOption.label,
          description: nativeHostOption.description,
        },
        {
          optionId: "simplified_mock",
          label: `Ship a simplified static stand-in for '${construct}'`,
          description: "Replace with a visible placeholder and record the feature gap in context/. No behavior parity.",
        },
      ],
    },
  };
}

/** Applies tier metadata onto a node without touching unrelated fields. */
export function withTierMeta(node: WidgetNode, meta: TierMetadata): WidgetNode {
  return {
    ...node,
    conversionTier: meta.conversionTier,
    recommendedPackages: meta.recommendedPackages,
    escalation: meta.escalation,
  };
}
