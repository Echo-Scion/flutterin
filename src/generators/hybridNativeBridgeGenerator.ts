/**
 * Hybrid Native-Flutter Bridge & Platform View Generator
 *
 * Solves the 100% pure-Flutter conversion limitation by generating:
 * 1. Multi-platform MethodChannel / EventChannel bridges in Dart.
 * 2. Platform View wrappers (AndroidView, UiKitView, AppKitView, HtmlElementView)
 *    for native-only UI components (WebView, MapView, SurfaceView, Camera, Canvas, Iframe).
 * 3. Sovereign SharedPreferences Bridge (FlutterPrefsReader.kt) to eliminate cold-start listener traps.
 * 4. System capability & permission gates (Accessibility, Overlay, Battery, Write Settings).
 * 5. Host-side native handler scaffolds for Android (Kotlin), iOS/macOS (Swift),
 *    Windows/Linux (C++), and Web (dart:js_interop).
 */

import { IdentitySanitizer, type TargetProjectIdentity } from "../core/identitySanitizer.js";

export interface DetectedNativeCapability {
  name: string;
  kind: "background_service" | "broadcast_receiver" | "system_overlay" | "platform_view" | "hardware_sensor" | "desktop_ipc" | "web_dom";
  sourcePlatform: "android" | "ios" | "desktop" | "web";
  rawIdentifier: string;
}

export interface HybridBridgeBundle {
  dartBridgeServiceCode: string;
  dartPlatformViewWidgetCode?: string;
  dartPermissionWidgetCode?: string;
  androidKotlinHandlerCode?: string;
  androidPrefsReaderCode?: string;
  iosSwiftHandlerCode?: string;
  desktopCppHandlerCode?: string;
  webJsInteropCode?: string;
}

export class HybridNativeBridgeGenerator {
  /**
   * Checks whether a source UI tag requires a native PlatformView instead of a pure Flutter widget.
   */
  public static isNativePlatformViewTag(rawTag: string): boolean {
    const normalized = rawTag.split(".").pop()?.toLowerCase() || rawTag.toLowerCase();
    const nativeOnlyTags = new Set([
      "webview", "wkwebview", "surfaceview", "textureview", "glsurfaceview",
      "mapview", "mkmapview", "fragmentcontainerview", "camerapreview", "videoview",
      "adview", "bannerview", "canvas", "iframe", "video", "audio", "embed", "object",
    ]);
    return nativeOnlyTags.has(normalized);
  }

  /**
   * Generates a cross-platform Flutter PlatformView widget expression (AndroidView / UiKitView / HtmlElementView)
   * when a layout converter encounters a native-only view tag.
   */
  public static generatePlatformViewWidgetExpr(
    rawTag: string,
    identity: TargetProjectIdentity,
    indentLevel: number
  ): string {
    const indent = "  ".repeat(indentLevel);
    const childIndent = "  ".repeat(indentLevel + 1);
    const safeTag = rawTag.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const cleanViewType = `${identity.packageId}/native_${IdentitySanitizer.toSnakeCase(rawTag)}`;

    return `Builder(
${childIndent}builder: (context) {
${childIndent}  if (kIsWeb) {
${childIndent}    return SizedBox(
${childIndent}      height: 240,
${childIndent}      child: HtmlElementView(viewType: '${cleanViewType}'),
${childIndent}    );
${childIndent}  }
${childIndent}  final platform = Theme.of(context).platform;
${childIndent}  if (platform == TargetPlatform.android) {
${childIndent}    return SizedBox(
${childIndent}      height: 240,
${childIndent}      child: AndroidView(
${childIndent}        viewType: '${cleanViewType}',
${childIndent}        creationParams: const <String, dynamic>{'sourceTag': '${safeTag}'},
${childIndent}        creationParamsCodec: const StandardMessageCodec(),
${childIndent}      ),
${childIndent}    );
${childIndent}  } else if (platform == TargetPlatform.iOS) {
${childIndent}    return SizedBox(
${childIndent}      height: 240,
${childIndent}      child: UiKitView(
${childIndent}        viewType: '${cleanViewType}',
${childIndent}        creationParams: const <String, dynamic>{'sourceTag': '${safeTag}'},
${childIndent}        creationParamsCodec: const StandardMessageCodec(),
${childIndent}      ),
${childIndent}    );
${childIndent}  }
${childIndent}  return Container(
${childIndent}    height: 240,
${childIndent}    alignment: Alignment.center,
${childIndent}    child: const Text('Native Platform View (${safeTag})'),
${childIndent}  );
${childIndent}},
${indent})`;
  }

  /**
   * Generates the sovereign Kotlin SharedPreferences Reader helper.
   */
  public static generateFlutterPrefsReader(identity: TargetProjectIdentity): string {
    return `package ${identity.packageId}

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/**
 * Generated Sovereign Clean-Room SharedPreferences Bridge for ${identity.appName}.
 *
 * Targets "FlutterSharedPreferences" directly to eliminate cold-start listener traps,
 * and provides safe decoders for JSON arrays and Base64-prefixed StringList formats.
 */
object FlutterPrefsReader {
    private const val PREFS_NAME = "FlutterSharedPreferences"
    private const val LIST_PREFIX = "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGxpc3Qu"

    fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun registerListener(context: Context, listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        getPrefs(context).registerOnSharedPreferenceChangeListener(listener)
    }

    fun unregisterListener(context: Context, listener: SharedPreferences.OnSharedPreferenceChangeListener) {
        getPrefs(context).unregisterOnSharedPreferenceChangeListener(listener)
    }

    fun getBoolean(context: Context, key: String, defaultValue: Boolean = false): Boolean {
        val prefs = getPrefs(context)
        val flutterKey = if (key.startsWith("flutter.")) key else "flutter.$key"
        return if (prefs.contains(flutterKey)) {
            prefs.getBoolean(flutterKey, defaultValue)
        } else {
            prefs.getBoolean(key, defaultValue)
        }
    }

    private val FLUTTER_DOUBLE_PREFIXES = arrayOf(
        "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGRvdWJsZS4=",
        "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBEb3VibGUu",
        "VGhpcyBpcyB0aGUgcHJlZml4IGZvciBhIGRvdWJsZS4"
    )

    fun getFloat(context: Context, key: String, defaultValue: Float = 0f): Float {
        val prefs = getPrefs(context)
        val flutterKey = if (key.startsWith("flutter.")) key else "flutter.$key"
        val targetKey = if (prefs.contains(flutterKey)) flutterKey else key
        val rawValue = prefs.all[targetKey] ?: return defaultValue
        return when (rawValue) {
            is Float -> if (rawValue.isFinite()) rawValue else defaultValue
            is Double -> if (rawValue.isFinite()) rawValue.toFloat() else defaultValue
            is Long -> {
                val fromBits = java.lang.Double.longBitsToDouble(rawValue).toFloat()
                if (fromBits.isFinite()) fromBits else defaultValue
            }
            is Int -> rawValue.toFloat()
            is String -> {
                var cleaned = rawValue.trim()
                for (prefix in FLUTTER_DOUBLE_PREFIXES) {
                    if (cleaned.startsWith(prefix)) {
                        cleaned = cleaned.substring(prefix.length).trimStart('=')
                        break
                    }
                }
                val parsed = cleaned.toDoubleOrNull()?.toFloat() ?: return defaultValue
                if (parsed.isFinite()) parsed else defaultValue
            }
            else -> defaultValue
        }
    }

    fun getDouble(context: Context, key: String, defaultValue: Double = 0.0): Double {
        val prefs = getPrefs(context)
        val flutterKey = if (key.startsWith("flutter.")) key else "flutter.$key"
        val targetKey = if (prefs.contains(flutterKey)) flutterKey else key
        val rawValue = prefs.all[targetKey] ?: return defaultValue
        return when (rawValue) {
            is Double -> if (rawValue.isFinite()) rawValue else defaultValue
            is Float -> if (rawValue.isFinite()) rawValue.toDouble() else defaultValue
            is Long -> {
                val fromBits = java.lang.Double.longBitsToDouble(rawValue)
                if (fromBits.isFinite()) fromBits else defaultValue
            }
            is Int -> rawValue.toDouble()
            is String -> {
                var cleaned = rawValue.trim()
                for (prefix in FLUTTER_DOUBLE_PREFIXES) {
                    if (cleaned.startsWith(prefix)) {
                        cleaned = cleaned.substring(prefix.length).trimStart('=')
                        break
                    }
                }
                val parsed = cleaned.toDoubleOrNull() ?: return defaultValue
                if (parsed.isFinite()) parsed else defaultValue
            }
            else -> defaultValue
        }
    }

    fun getString(context: Context, key: String, defaultValue: String? = null): String? {
        val prefs = getPrefs(context)
        val flutterKey = if (key.startsWith("flutter.")) key else "flutter.$key"
        return if (prefs.contains(flutterKey)) {
            prefs.getString(flutterKey, defaultValue)
        } else {
            prefs.getString(key, defaultValue)
        }
    }

    fun getStringList(context: Context, key: String): List<String> {
        val prefs = getPrefs(context)
        val flutterKey = if (key.startsWith("flutter.")) key else "flutter.$key"
        val raw = prefs.getString(flutterKey, null) ?: prefs.getString(key, null)
        if (raw != null) {
            if (raw.startsWith(LIST_PREFIX)) {
                try {
                    val jsonPart = raw.substring(LIST_PREFIX.length)
                    val arr = JSONArray(jsonPart)
                    val result = mutableListOf<String>()
                    for (i in 0 until arr.length()) {
                        result.add(arr.getString(i))
                    }
                    return result
                } catch (_: Exception) {}
            }
            try {
                val arr = JSONArray(raw)
                val result = mutableListOf<String>()
                for (i in 0 until arr.length()) {
                    result.add(arr.getString(i))
                }
                return result
            } catch (_: Exception) {}
        }
        return try {
            (prefs.getStringSet(flutterKey, null) ?: prefs.getStringSet(key, null))?.toList() ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }
}
`;
  }

  /**
   * Generates the complete Hybrid Native-Flutter Bridge bundle across Dart, Kotlin, Swift, C++, and Web JS Interop.
   */
  public static generateHybridBridgeBundle(
    identity: TargetProjectIdentity,
    capabilities: DetectedNativeCapability[]
  ): HybridBridgeBundle {
    const channelName = `${identity.packageId}/native_bridge`;
    const eventChannelName = `${identity.packageId}/native_events`;
    const serviceClassName = `${identity.pascalPrefix}NativeBridgeService`;

    const hasOverlay = capabilities.some((c) => c.kind === "system_overlay");
    const hasService = capabilities.some((c) => c.kind === "background_service");

    const methodStubsDart = capabilities
      .map((cap) => {
        const methodName = this.toCamelCase(`invoke_${cap.name}`);
        return `  /// Bridges native capability: ${cap.rawIdentifier} (${cap.sourcePlatform} - ${cap.kind})
  Future<Map<String, dynamic>?> ${methodName}([Map<String, dynamic>? args]) async {
    final result = await _channel.invokeMapMethod<String, dynamic>(
      '${cap.name}',
      args ?? const <String, dynamic>{},
    );
    return result;
  }`;
      })
      .join("\n\n");

    const permissionStubsDart: string[] = [];
    if (hasOverlay) {
      permissionStubsDart.push(`  /// Checks if SYSTEM_ALERT_WINDOW overlay permission is granted.
  Future<bool> canDrawOverlays() async {
    final res = await _channel.invokeMethod<bool>('canDrawOverlays');
    return res ?? false;
  }

  /// Opens system settings for overlay permission.
  Future<void> openOverlaySettings() async {
    await _channel.invokeMethod('openOverlaySettings');
  }`);
    }

    if (hasService) {
      permissionStubsDart.push(`  /// Checks if the native accessibility / background service is active.
  Future<bool> isServiceEnabled() async {
    final res = await _channel.invokeMethod<bool>('isServiceEnabled');
    return res ?? false;
  }

  /// Opens Android Accessibility Settings screen.
  Future<void> openAccessibilitySettings() async {
    await _channel.invokeMethod('openAccessibilitySettings');
  }

  /// Requests battery optimization exemption for background persistence.
  Future<void> requestIgnoreBatteryOptimizations() async {
    await _channel.invokeMethod('requestIgnoreBatteryOptimizations');
  }`);
    }

    const allDartMethods = [methodStubsDart, ...permissionStubsDart]
      .filter(Boolean)
      .join("\n\n");

    const dartBridgeServiceCode = `import 'dart:async';
import 'package:flutter/services.dart';

/// Generated Clean-Room Hybrid Native Bridge for ${identity.appName}.
/// Connects Flutter 3 / Dart 3 to platform-specific capabilities across
/// Android (Kotlin), iOS/macOS (Swift), Desktop (C++/FFI), and Web (JS Interop).
class ${serviceClassName} {
  const ${serviceClassName}();

  static const MethodChannel _channel = MethodChannel('${channelName}');
  static const EventChannel _eventChannel = EventChannel('${eventChannelName}');

  /// Stream of native lifecycle, broadcast, or sensor events from the host OS.
  Stream<dynamic> get nativeEvents => _eventChannel.receiveBroadcastStream();

${allDartMethods || `  Future<bool> pingHost() async {\n    final res = await _channel.invokeMethod<bool>('ping');\n    return res ?? false;\n  }`}
}
`;

    // Dart Permission Gate widget
    const dartPermissionWidgetCode = (hasOverlay || hasService) ? `import 'package:flutter/material.dart';
import 'native_capability_bridge.dart';

/// Clean-room permission guard banner for required system overlay / service permissions.
class NativePermissionGateCard extends StatefulWidget {
  final ${serviceClassName} bridge;
  final VoidCallback? onPermissionsConfirmed;

  const NativePermissionGateCard({
    super.key,
    required this.bridge,
    this.onPermissionsConfirmed,
  });

  @override
  State<NativePermissionGateCard> createState() => _NativePermissionGateCardState();
}

class _NativePermissionGateCardState extends State<NativePermissionGateCard> with WidgetsBindingObserver {
  bool _isServiceActive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkStatus();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkStatus();
    }
  }

  Future<void> _checkStatus() async {
    final active = await widget.bridge.isServiceEnabled();
    if (mounted) {
      setState(() => _isServiceActive = active);
      if (active) widget.onPermissionsConfirmed?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isServiceActive) return const SizedBox.shrink();

    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: ListTile(
        leading: Icon(Icons.warning_amber_rounded, color: Theme.of(context).colorScheme.onErrorContainer),
        title: const Text('System Permission Required'),
        subtitle: const Text('Enable service in system settings for overlay functionality.'),
        trailing: FilledButton(
          onPressed: () => widget.bridge.openAccessibilitySettings(),
          child: const Text('Configure'),
        ),
      ),
    );
  }
}
` : undefined;

    const kotlinCasesList: string[] = [];

    if (hasOverlay) {
      kotlinCasesList.push(`                "canDrawOverlays" -> {
                    val canDraw = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        android.provider.Settings.canDrawOverlays(this)
                    } else true
                    result.success(canDraw)
                }
                "openOverlaySettings" -> {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        val intent = android.content.Intent(
                            android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            android.net.Uri.parse("package:\$packageName")
                        )
                        startActivity(intent)
                    }
                    result.success(true)
                }`);
    }

    if (hasService) {
      kotlinCasesList.push(`                "isServiceEnabled" -> {
                    val am = getSystemService(android.content.Context.ACCESSIBILITY_SERVICE) as? android.view.accessibility.AccessibilityManager
                    val enabled = am?.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
                        ?.any { it.resolveInfo.serviceInfo.packageName == packageName } == true
                    result.success(enabled)
                }
                "openAccessibilitySettings" -> {
                    val intent = android.content.Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    startActivity(intent)
                    result.success(true)
                }
                "requestIgnoreBatteryOptimizations" -> {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        val pm = getSystemService(android.content.Context.POWER_SERVICE) as? android.os.PowerManager
                        if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                            val intent = android.content.Intent(
                                android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                android.net.Uri.parse("package:\$packageName")
                            )
                            startActivity(intent)
                        }
                    }
                    result.success(true)
                }`);
    }

    for (const cap of capabilities) {
      kotlinCasesList.push(`                "${cap.name}" -> {
                    // TODO: Implement native Android ${cap.kind} for ${cap.rawIdentifier}
                    result.success(mapOf("status" to "ok", "capability" to "${cap.name}"))
                }`);
    }

    const kotlinCases = kotlinCasesList.join("\n");

    const androidKotlinHandlerCode = `package ${identity.packageId}

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Generated Clean-Room Android Host Bridge for ${identity.appName}.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "${channelName}"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
${kotlinCases || `                "ping" -> result.success(true)`}
                    else -> result.notImplemented()
                }
            }
    }
}
`;

    const swiftCases = capabilities
      .map(
        (cap) => `      case "${cap.name}":
        // TODO: Implement native iOS/macOS ${cap.kind} for ${cap.rawIdentifier}
        result(["status": "ok", "capability": "${cap.name}"])`
      )
      .join("\n");

    const iosSwiftHandlerCode = `import Flutter
import UIKit

/// Generated Clean-Room iOS Host Bridge for ${identity.appName}.
@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    let channel = FlutterMethodChannel(
      name: "${channelName}",
      binaryMessenger: controller.binaryMessenger
    )

    channel.setMethodCallHandler({ (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      switch call.method {
${swiftCases || `      case "ping":\n        result(true)`}
      default:
        result(FlutterMethodNotImplemented)
      }
    })

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

    const desktopCppHandlerCode = `// Generated Clean-Room Desktop (Windows / Linux) C++ MethodChannel Handler for ${identity.appName}
// Channel: ${channelName}

#include <flutter/method_channel.h>
#include <flutter/standard_method_codec.h>

void Register${identity.pascalPrefix}NativeBridge(flutter::BinaryMessenger* messenger) {
  auto channel = std::make_unique<flutter::MethodChannel<flutter::EncodableValue>>(
      messenger, "${channelName}",
      &flutter::StandardMethodCodec::GetInstance());

  channel->SetMethodCallHandler(
      [](const flutter::MethodCall<flutter::EncodableValue>& call,
         std::unique_ptr<flutter::MethodResult<flutter::EncodableValue>> result) {
        if (call.method_name().compare("ping") == 0) {
          result->Success(flutter::EncodableValue(true));
        } else {
          result->NotImplemented();
        }
      });
}
`;

    const webJsInteropCode = `import 'dart:js_interop';
import 'package:web/web.dart' as web;

/// Generated Clean-Room Dart 3 Web Interop Bridge for ${identity.appName}.
/// Uses modern Wasm-compatible dart:js_interop and package:web.

class ${identity.pascalPrefix}WebDomBridge {
  const ${identity.pascalPrefix}WebDomBridge();

  String get currentOrigin => web.window.location.origin;

  void postWindowMessage(String message) {
    web.window.postMessage(message.toJS, '*'.toJS);
  }
}
`;

    const androidPrefsReaderCode = this.generateFlutterPrefsReader(identity);

    return {
      dartBridgeServiceCode,
      dartPermissionWidgetCode,
      androidKotlinHandlerCode,
      androidPrefsReaderCode,
      iosSwiftHandlerCode,
      desktopCppHandlerCode,
      webJsInteropCode,
    };
  }

  private static toCamelCase(str: string): string {
    const pascal = IdentitySanitizer.toPascalCase(str);
    return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "invokeCapability";
  }
}
