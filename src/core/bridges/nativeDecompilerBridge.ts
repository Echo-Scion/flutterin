/**
 * Native Binary Decompiler Bridge
 * Bridges to external CLI tools: Rizin (rz-bin) and WABT (wasm2wat).
 * Gracefully reports availability and falls back to built-in decoders when tools are not installed.
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RizinDisassemblyResult {
  functions: {
    offset: number;
    name: string;
    size: number;
  }[];
  strings: string[];
}

export class NativeDecompilerBridge {
  public static async isCommandAvailable(cmd: string, args: string[] = []): Promise<boolean> {
    try {
      await execFileAsync(cmd, args, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  public static async runRizinAnalysis(binaryPath: string): Promise<RizinDisassemblyResult | null> {
    const isAvail = await this.isCommandAvailable("rz-bin", ["-v"]);
    if (!isAvail) return null;

    try {
      // Get exported symbols
      const { stdout: symOut } = await execFileAsync("rz-bin", ["-E", "-j", binaryPath], { timeout: 15000 });
      let functions: { offset: number; name: string; size: number }[] = [];
      try {
        const symsParsed = JSON.parse(symOut);
        const syms = Array.isArray(symsParsed) ? symsParsed : (symsParsed?.exports || symsParsed?.symbols || []);
        if (Array.isArray(syms)) {
          functions = syms.map((s: any) => ({
            offset: s.vaddr || s.paddr || 0,
            name: s.name || "unnamed",
            size: s.size || 0,
          }));
        }
      } catch {
        // fallback to empty
      }

      // Get strings
      const { stdout: strOut } = await execFileAsync("rz-bin", ["-z", "-j", binaryPath], { timeout: 15000 });
      let strings: string[] = [];
      try {
        const strParsed = JSON.parse(strOut);
        const strList = Array.isArray(strParsed) ? strParsed : (strParsed?.strings || []);
        if (Array.isArray(strList)) {
          strings = strList.map((s: any) => s.string || "").filter((s: string) => s.length > 3).slice(0, 100);
        }
      } catch {
        // fallback to empty
      }

      return { functions, strings };
    } catch {
      return null;
    }
  }

  public static async wasmToWat(wasmPath: string, watOutputPath: string): Promise<boolean> {
    const isAvail = await this.isCommandAvailable("wasm2wat", ["--version"]);
    if (!isAvail) return false;

    try {
      await execFileAsync("wasm2wat", [wasmPath, "-o", watOutputPath], { timeout: 20000 });
      return fs.existsSync(watOutputPath);
    } catch {
      return false;
    }
  }
}
