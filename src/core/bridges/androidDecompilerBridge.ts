/**
 * Android & Mobile Decompiler Bridge
 * Bridges to external CLI tools: Apktool, JADX Headless, and ADB.
 * Gracefully reports availability and falls back to built-in decoders when tools are not installed.
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DecompileResult {
  success: boolean;
  toolUsed: string;
  outputDirectory: string;
  filesGenerated: number;
  stdout?: string;
  error?: string;
}

export interface AdbDeviceInfo {
  id: string;
  state: "device" | "offline" | "unauthorized" | "unknown";
  model?: string;
}

export class AndroidDecompilerBridge {
  public static async isCommandAvailable(cmd: string, args: string[] = ["--version"]): Promise<boolean> {
    const parts = cmd.trim().split(/\s+/);
    const bin = parts[0];
    const effectiveArgs = parts.length > 1 ? parts.slice(1) : args;
    const candidates = process.platform === "win32" && !/\.(exe|cmd|bat)$/i.test(bin)
      ? [bin, `${bin}.bat`, `${bin}.cmd`, `${bin}.exe`]
      : [bin];

    for (const candidate of candidates) {
      try {
        await execFileAsync(candidate, effectiveArgs, { timeout: 5000 });
        return true;
      } catch (err: any) {
        if (err?.code === "ENOENT") continue;
        // If it exited with code or output, the binary exists
        if (err?.stdout || err?.stderr || typeof err?.code === "number") {
          return true;
        }
      }
    }
    return false;
  }

  public static async runApktool(apkPath: string, outputDir: string): Promise<DecompileResult> {
    const isAvail = await this.isCommandAvailable("apktool", ["-version"]);
    if (!isAvail) {
      return {
        success: false,
        toolUsed: "apktool",
        outputDirectory: outputDir,
        filesGenerated: 0,
        error: "apktool is not installed or not found on PATH. Use winget/brew/scoop to install apktool.",
      };
    }

    fs.mkdirSync(outputDir, { recursive: true });
    try {
      const { stdout } = await execFileAsync("apktool", ["d", "-f", "--no-src", "-o", outputDir, apkPath], {
        timeout: 60000,
      });

      const files = fs.readdirSync(outputDir);
      return {
        success: true,
        toolUsed: "apktool",
        outputDirectory: outputDir,
        filesGenerated: files.length,
        stdout,
      };
    } catch (err: any) {
      return {
        success: false,
        toolUsed: "apktool",
        outputDirectory: outputDir,
        filesGenerated: 0,
        error: err?.message || String(err),
      };
    }
  }

  private static countFilesRecursive(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) count += this.countFilesRecursive(full);
      else count++;
    }
    return count;
  }

  public static async runJadx(apkOrDexPath: string, outputDir: string): Promise<DecompileResult> {
    const isAvail = await this.isCommandAvailable("jadx", ["--version"]);
    if (!isAvail) {
      return {
        success: false,
        toolUsed: "jadx",
        outputDirectory: outputDir,
        filesGenerated: 0,
        error: "jadx is not installed or not found on PATH. Install via: winget install jadx / brew install jadx.",
      };
    }

    fs.mkdirSync(outputDir, { recursive: true });
    try {
      const { stdout } = await execFileAsync("jadx", ["-d", outputDir, "--no-res", apkOrDexPath], {
        timeout: 120000,
      });

      return {
        success: true,
        toolUsed: "jadx",
        outputDirectory: outputDir,
        filesGenerated: this.countFilesRecursive(outputDir),
        stdout,
      };
    } catch (err: any) {
      return {
        success: false,
        toolUsed: "jadx",
        outputDirectory: outputDir,
        filesGenerated: 0,
        error: err?.message || String(err),
      };
    }
  }

  public static async listAdbDevices(): Promise<AdbDeviceInfo[]> {
    try {
      const { stdout } = await execFileAsync("adb", ["devices", "-l"], { timeout: 4000 });
      const lines = stdout.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("List of devices"));
      const devices: AdbDeviceInfo[] = [];

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const modelMatch = line.match(/model:([^\s]+)/);
          devices.push({
            id: parts[0],
            state: parts[1] as any,
            model: modelMatch ? modelMatch[1] : undefined,
          });
        }
      }

      return devices;
    } catch {
      return [];
    }
  }

  public static async dumpLiveUiHierarchy(): Promise<string> {
    try {
      // Try direct exec-out
      const { stdout } = await execFileAsync("adb", ["exec-out", "uiautomator", "dump", "/dev/tty"], { timeout: 8000 });
      if (stdout.includes("<?xml") || stdout.includes("<hierarchy")) {
        return stdout;
      }

      // Fallback via sdcard dump
      await execFileAsync("adb", ["shell", "uiautomator", "dump", "/sdcard/window_dump.xml"], { timeout: 6000 });
      const { stdout: xmlOut } = await execFileAsync("adb", ["shell", "cat", "/sdcard/window_dump.xml"], { timeout: 6000 });
      return xmlOut;
    } catch (err: any) {
      throw new Error(`ADB UI hierarchy dump failed: ${err?.message || String(err)}`);
    }
  }

  public static async pullPackageApk(packageName: string, destinationDir: string): Promise<string> {
    if (!/^[a-zA-Z0-9_.]+$/.test(packageName)) {
      throw new Error(`Invalid package name format: ${packageName}`);
    }
    try {
      const { stdout: pathOut } = await execFileAsync("adb", ["shell", "pm", "path", packageName], { timeout: 6000 });
      const match = pathOut.match(/package:([^\r\n]+)/);
      if (!match || !match[1]) {
        throw new Error(`Package ${packageName} not found on connected ADB device.`);
      }

      const remoteApkPath = match[1].trim();
      const localApkName = `${packageName}.apk`;
      const localApkPath = path.join(destinationDir, localApkName);

      fs.mkdirSync(destinationDir, { recursive: true });
      await execFileAsync("adb", ["pull", remoteApkPath, localApkPath], { timeout: 30000 });

      return localApkPath;
    } catch (err: any) {
      throw new Error(`Failed to pull APK for ${packageName}: ${err?.message || String(err)}`);
    }
  }
}
