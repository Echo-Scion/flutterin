import { open, stat } from "node:fs/promises";
import { EngineCatalog, type EngineMetadata } from "./engineCatalog.js";
import { NativeBinaryReader, type NativeBinaryAnalysis } from "../../core/decoders/nativeBinaryReader.js";
import { SymbolReconstructor, type ExtractedDartClass } from "./symbolReconstructor.js";
import { NativeDecompilerBridge, type RizinDisassemblyResult } from "../../core/bridges/nativeDecompilerBridge.js";

export interface AotSnapshotReport {
  filePath: string;
  architecture: "arm64" | "arm" | "x64" | "unknown";
  isFlutterBinary: boolean;
  snapshotHash?: string;
  flags?: string[];
  engineCommits: string[];
  dartVersion?: string;
  matchedEngine?: EngineMetadata | null;
  symbolsFound: string[];
  nativeAnalysis?: NativeBinaryAnalysis;
  reconstructedClasses?: ExtractedDartClass[];
  rizinDisassembly?: RizinDisassemblyResult | null;
}

/**
 * Pure binary reader for Flutter AOT snapshots and engine libraries.
 * Reads ELF structures, Dart VM snapshot headers, and engine metadata.
 */
export class AotSnapshotReader {
  /**
   * Analyzes an AOT binary (such as libapp.so or libflutter.so).
   */
  public async analyzeBinary(filePath: string): Promise<AotSnapshotReport> {
    const fileStat = await stat(filePath);
    const readSize = Math.min(Number(fileStat.size), 16 * 1024 * 1024); // read up to 16MB
    const buffer = Buffer.alloc(readSize);

    const fh = await open(filePath, "r");
    try {
      await fh.read(buffer, 0, readSize, 0);
    } finally {
      await fh.close();
    }

    const report = await this.analyzeBuffer(buffer, filePath);
    try {
      const reconstructor = new SymbolReconstructor();
      report.reconstructedClasses = await reconstructor.extractClassesFromBinary(filePath);
    } catch {
      // ignore symbol reconstruction failure
    }
    try {
      report.rizinDisassembly = await NativeDecompilerBridge.runRizinAnalysis(filePath);
    } catch {
      // ignore rizin analysis failure
    }
    return report;
  }

  /**
   * Analyzes an AOT binary buffer directly.
   */
  public async analyzeBuffer(buffer: Buffer, filePath: string = "buffer"): Promise<AotSnapshotReport> {
    const report: AotSnapshotReport = {
      filePath,
      architecture: this.detectArchitecture(buffer),
      isFlutterBinary: false,
      engineCommits: [],
      symbolsFound: [],
    };

    // 1. Detect if it is a Flutter / Dart binary
    const contentLatin1 = buffer.toString("latin1");
    if (
      contentLatin1.includes("Dart_Initialize") ||
      contentLatin1.includes("FlutterEngine") ||
      contentLatin1.includes("_kDartVmSnapshotData") ||
      contentLatin1.includes("_kDartIsolateSnapshotData") ||
      contentLatin1.includes("_kDartSnapshotText")
    ) {
      report.isFlutterBinary = true;
    }

    // 2. Extract snapshot hash (32-hex characters near Dart snapshot markers)
    const snapshotMarkerIndex = buffer.indexOf("_kDartVmSnapshotData");
    if (snapshotMarkerIndex !== -1) {
      report.isFlutterBinary = true;
      report.symbolsFound.push("_kDartVmSnapshotData");
      const windowStr = buffer.subarray(snapshotMarkerIndex, snapshotMarkerIndex + 300).toString("latin1");
      const hashMatch = windowStr.match(/([a-f0-9]{32})/);
      if (hashMatch) {
        report.snapshotHash = hashMatch[1];
        const hashIdx = windowStr.indexOf(hashMatch[1]);
        const afterHash = windowStr.slice(hashIdx + 32);
        const flagsMatch = afterHash.match(/[\x00\s]*([a-z0-9_\-\s]{3,120})\x00/);
        if (flagsMatch && flagsMatch[1].trim()) {
          report.flags = flagsMatch[1].trim().split(/\s+/);
        }
      }
    } else {
      // Fallback: regex search for 32-char hex string followed by flags
      const flagMatch = contentLatin1.match(/([a-f0-9]{32})\x00([a-z0-9_\-\s]{5,100})\x00/);
      if (flagMatch) {
        report.snapshotHash = flagMatch[1];
        report.flags = flagMatch[2].trim().split(/\s+/);
      }
    }

    // 3. Extract Engine 40-hex commit hashes
    const commitMatches = contentLatin1.match(/[a-f0-9]{40}/g) || [];
    const uniqueCommits = Array.from(new Set(commitMatches)).slice(0, 3);
    report.engineCommits = uniqueCommits;
    if (uniqueCommits.length > 0) {
      report.isFlutterBinary = true;
    }

    // 4. Extract Dart version string e.g. "3.4.1 (stable)"
    const dartVerMatch = contentLatin1.match(/(\d+\.\d+\.\d+[\w\.\-]*)\s*\((stable|beta|dev)\)/);
    if (dartVerMatch) {
      report.dartVersion = `${dartVerMatch[1]} (${dartVerMatch[2]})`;
    }

    // 5. Match with Engine Catalog
    if (report.snapshotHash) {
      report.matchedEngine = await EngineCatalog.findBySnapshotHash(report.snapshotHash);
    } else if (report.engineCommits.length > 0) {
      report.matchedEngine = await EngineCatalog.findByCommit(report.engineCommits[0]);
    }

    // 6. Run Native Binary Reader for general ELF, PE, Mach-O, WASM and FFI generation
    try {
      const nativeReader = new NativeBinaryReader(buffer);
      report.nativeAnalysis = nativeReader.analyze();
    } catch {
      // ignore
    }

    return report;
  }

  private detectArchitecture(buffer: Buffer): "arm64" | "arm" | "x64" | "unknown" {
    if (buffer.length < 20 || buffer[0] !== 0x7f || buffer[1] !== 0x45 || buffer[2] !== 0x4c || buffer[3] !== 0x46) {
      return "unknown"; // Not an ELF binary
    }
    // e_machine offset in ELF is at 0x12 (18)
    const eMachine = buffer.readUInt16LE(18);
    if (eMachine === 183) return "arm64"; // EM_AARCH64
    if (eMachine === 40) return "arm"; // EM_ARM
    if (eMachine === 62) return "x64"; // EM_X86_64
    return "unknown";
  }
}
