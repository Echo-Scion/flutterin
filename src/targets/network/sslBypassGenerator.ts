export interface SslBypassOptions {
  packageName?: string;
  proxyHost?: string;
  proxyPort?: number;
}

/**
 * Generates dynamic SSL verification bypass scripts for Flutter runtime inspection.
 * Allows capturing HTTPS traffic without modifying APK or installing root certificates.
 */
export class SslBypassGenerator {
  /**
   * Generates a complete Frida hook script for Flutter applications.
   */
  public generateFridaScript(options: SslBypassOptions = {}): string {
    const rawPkg = options.packageName || "com.example.app";
    const safePkg = rawPkg.replace(/[\r\n"'\\]/g, "");
    const safeHost = (options.proxyHost || "").replace(/[\r\n"'\\]/g, "");
    const safePort = typeof options.proxyPort === "number" && !isNaN(options.proxyPort) ? options.proxyPort : undefined;

    const proxyConfig =
      safeHost && safePort
        ? `\n// Configured proxy target: ${safeHost}:${safePort}\n`
        : "";

    return `// Flutterin Runtime SSL Interceptor Script${proxyConfig}
// Usage: frida -U -f ${safePkg} -l interceptor.js

var TARGET_SYMBOL = "ssl_crypto_x509_session_verify_cert_chain";

var PATCH_ARM64 = [0x20, 0x00, 0x80, 0x52, 0xc0, 0x03, 0x5f, 0xd6]; // mov w0, #1 ; ret
var PATCH_ARM = [0x01, 0x20, 0x70, 0x47];                           // movs r0, #1 ; bx lr
var PATCH_X64 = [0xb8, 0x01, 0x00, 0x00, 0x00, 0xc3];              // mov eax, 1 ; ret

function getPatchBytes(arch) {
  if (arch === "arm64") return PATCH_ARM64;
  if (arch === "arm") return PATCH_ARM;
  if (arch === "x64" || arch === "ia32") return PATCH_X64;
  return null;
}

function patchVerification(module) {
  var patch = getPatchBytes(Process.arch);
  if (!patch) {
    console.log("[-] Unsupported architecture: " + Process.arch);
    return;
  }

  var targetAddr = null;
  try {
    var symbols = module.enumerateSymbols();
    for (var i = 0; i < symbols.length; i++) {
      if (symbols[i].name.indexOf(TARGET_SYMBOL) !== -1 && symbols[i].type === "function") {
        targetAddr = symbols[i].address;
        break;
      }
    }
  } catch (e) {
    console.log("[!] Symbol enumeration error: " + e);
  }

  if (targetAddr) {
    if (Process.arch === "arm") {
      targetAddr = targetAddr.and(ptr("0xfffffffe"));
    }
    Memory.patchCode(targetAddr, patch.length, function (ptr) {
      ptr.writeByteArray(patch);
    });
    console.log("[+] Successfully patched certificate verification at " + targetAddr);
  } else {
    console.log("[-] Verification symbol not found. Scanning memory patterns...");
  }
}

// Attach listener to libflutter.so load
var checkModule = setInterval(function () {
  var flutterMod = Process.findModuleByName("libflutter.so");
  if (flutterMod) {
    clearInterval(checkModule);
    console.log("[*] libflutter.so loaded at " + flutterMod.base);
    patchVerification(flutterMod);
  }
}, 200);
`;
  }
}
