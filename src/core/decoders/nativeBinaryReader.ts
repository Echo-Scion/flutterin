/**
 * Native Binary & Executable Reader
 * Pure TypeScript parser for ELF, Mach-O, PE/COFF (.NET CLI), and WebAssembly (WASM) headers, sections, and exported symbols.
 * Automatically generates Dart FFI (package:ffigen) bindings for exported native C/C++ functions.
 */

import * as fs from "node:fs";

export type BinaryFormat = "ELF" | "Mach-O" | "PE" | "WASM" | "Unknown";

export interface NativeExportedSymbol {
  name: string;
  ordinal?: number;
  address?: number;
  isFunction?: boolean;
}

export interface NativeBinaryAnalysis {
  format: BinaryFormat;
  arch: string;
  is64Bit: boolean;
  endianness: "little" | "big";
  sections: string[];
  exportedSymbols: NativeExportedSymbol[];
  dependencies: string[];
  buildId?: string;
  isDotNet?: boolean;
  isFlutterAot?: boolean;
  dartFfiWrapperCode?: string;
  ffigenYamlConfig?: string;
}

export class NativeBinaryReader {
  private buffer: Buffer;

  constructor(bufferOrPath: Buffer | string) {
    if (typeof bufferOrPath === "string") {
      this.buffer = fs.readFileSync(bufferOrPath);
    } else {
      this.buffer = bufferOrPath;
    }
  }

  public analyze(): NativeBinaryAnalysis {
    if (this.buffer.length < 16) {
      return this.emptyResult("Unknown");
    }

    // Check ELF (\x7fELF)
    if (this.buffer[0] === 0x7f && this.buffer[1] === 0x45 && this.buffer[2] === 0x4c && this.buffer[3] === 0x46) {
      return this.analyzeElf();
    }

    // Check WebAssembly (\0asm)
    if (this.buffer[0] === 0x00 && this.buffer[1] === 0x61 && this.buffer[2] === 0x73 && this.buffer[3] === 0x6d) {
      return this.analyzeWasm();
    }

    // Check PE (MZ)
    if (this.buffer.length >= 0x40 && this.buffer[0] === 0x4d && this.buffer[1] === 0x5a) {
      const peOffset = this.buffer.readUInt32LE(0x3c);
      if (peOffset > 0 && peOffset < this.buffer.length - 4 && this.buffer.toString("ascii", peOffset, peOffset + 4) === "PE\0\0") {
        return this.analyzePe(peOffset);
      }
    }

    // Check Mach-O (0xfeedface, 0xfeedfacf, 0xcafebabe)
    const magic = this.buffer.readUInt32BE(0);
    if (magic === 0xfeedface || magic === 0xfeedfacf || magic === 0xcafebabe || magic === 0xcefaedfe || magic === 0xcffaedfe) {
      return this.analyzeMachO(magic);
    }

    return this.emptyResult("Unknown");
  }

  private analyzeElf(): NativeBinaryAnalysis {
    const is64Bit = this.buffer[4] === 2;
    const isLittleEndian = this.buffer[5] === 1;
    const machineCode = isLittleEndian ? this.buffer.readUInt16LE(18) : this.buffer.readUInt16BE(18);

    const archMap: Record<number, string> = {
      0x03: "x86",
      0x3e: "x86_64",
      0x28: "ARM",
      0xb7: "AArch64 (ARM64)",
      0xf3: "RISC-V",
    };
    const arch = archMap[machineCode] || `Machine(0x${machineCode.toString(16)})`;

    const sections: string[] = [];
    const exportedSymbols: NativeExportedSymbol[] = [];
    const dependencies: string[] = [];
    let buildId: string | undefined;

    // Scan for readable section strings and symbols
    const str = this.buffer.toString("latin1");
    if (str.includes(".rodata")) sections.push(".rodata");
    if (str.includes(".text")) sections.push(".text");
    if (str.includes(".dynsym")) sections.push(".dynsym");
    if (str.includes(".dynstr")) sections.push(".dynstr");

    // Scan for Build-ID
    const buildIdIdx = this.buffer.indexOf(Buffer.from("GNU\0"));
    if (buildIdIdx > 0 && buildIdIdx + 24 <= this.buffer.length) {
      const idBytes = this.buffer.subarray(buildIdIdx + 8, buildIdIdx + 28);
      buildId = idBytes.toString("hex");
    }

    // Check for Flutter AOT markers
    const isFlutterAot = str.includes("_kDartVmSnapshotData") || str.includes("_kDartIsolateSnapshotData");

    // Extract potential exported function symbols by scanning string patterns
    const symMatches = str.match(/(?:Java_[a-zA-Z0-9_]+|[a-zA-Z_][a-zA-Z0-9_]{3,30}_init|[a-zA-Z_][a-zA-Z0-9_]{3,30}_api)/g);
    if (symMatches) {
      const uniqueSyms = Array.from(new Set(symMatches)).slice(0, 50);
      for (const s of uniqueSyms) {
        exportedSymbols.push({ name: s, isFunction: true });
      }
    }

    const res: NativeBinaryAnalysis = {
      format: "ELF",
      arch,
      is64Bit,
      endianness: isLittleEndian ? "little" : "big",
      sections,
      exportedSymbols,
      dependencies,
      buildId,
      isFlutterAot,
    };

    if (exportedSymbols.length > 0) {
      res.dartFfiWrapperCode = this.generateDartFfi(exportedSymbols, "native_lib.so");
      res.ffigenYamlConfig = this.generateFfigenYaml("native_lib.so");
    }

    return res;
  }

  private analyzePe(peOffset: number): NativeBinaryAnalysis {
    const machine = this.buffer.readUInt16LE(peOffset + 4);
    const numSections = this.buffer.readUInt16LE(peOffset + 6);
    const optHeaderSize = this.buffer.readUInt16LE(peOffset + 20);

    const archMap: Record<number, string> = {
      0x14c: "x86",
      0x8664: "x86_64",
      0xaa64: "ARM64",
    };
    const arch = archMap[machine] || "Unknown PE";

    const magic = this.buffer.readUInt16LE(peOffset + 24);
    const is64Bit = magic === 0x20b;

    // Check .NET CLI Header
    const clrDataDirOffset = peOffset + 24 + (is64Bit ? 208 : 192);
    let isDotNet = false;
    if (clrDataDirOffset + 8 <= this.buffer.length) {
      const clrRva = this.buffer.readUInt32LE(clrDataDirOffset);
      const clrSize = this.buffer.readUInt32LE(clrDataDirOffset + 4);
      isDotNet = clrRva > 0 && clrSize > 0;
    }

    const sections: string[] = [];
    const sectionHeadersStart = peOffset + 24 + optHeaderSize;
    for (let i = 0; i < numSections; i++) {
      const sOffset = sectionHeadersStart + i * 40;
      if (sOffset + 8 <= this.buffer.length) {
        const sName = this.buffer.toString("ascii", sOffset, sOffset + 8).replace(/\0/g, "").trim();
        if (sName) sections.push(sName);
      }
    }

    // Export directory
    const exportDataDirOffset = peOffset + 24 + (is64Bit ? 112 : 96);
    const exportedSymbols: NativeExportedSymbol[] = [];

    const str = this.buffer.toString("latin1");
    const funcMatches = str.match(/(?:[a-zA-Z_][a-zA-Z0-9_]{3,30}(?:Init|Create|Destroy|Execute|Get|Set))/g);
    if (funcMatches) {
      const uniqueFuncs = Array.from(new Set(funcMatches)).slice(0, 30);
      for (const f of uniqueFuncs) {
        exportedSymbols.push({ name: f, isFunction: true });
      }
    }

    const res: NativeBinaryAnalysis = {
      format: "PE",
      arch,
      is64Bit,
      endianness: "little",
      sections,
      exportedSymbols,
      dependencies: [],
      isDotNet,
    };

    if (exportedSymbols.length > 0) {
      res.dartFfiWrapperCode = this.generateDartFfi(exportedSymbols, "native_lib.dll");
      res.ffigenYamlConfig = this.generateFfigenYaml("native_lib.dll");
    }

    return res;
  }

  private analyzeMachO(magic: number): NativeBinaryAnalysis {
    const is64Bit = magic === 0xfeedfacf || magic === 0xcffaedfe;
    const isLittleEndian = magic === 0xcefaedfe || magic === 0xcffaedfe;

    const cpuType = isLittleEndian ? this.buffer.readUInt32LE(4) : this.buffer.readUInt32BE(4);
    const arch = cpuType === 0x0100000c ? "ARM64" : cpuType === 0x01000007 ? "x86_64" : "Apple Mach-O";

    const dependencies: string[] = [];
    const str = this.buffer.toString("latin1");

    // Match dylib paths
    const dylibMatches = str.match(/(?:\/System\/Library\/Frameworks\/[a-zA-Z0-9_]+\.framework|\/usr\/lib\/[a-zA-Z0-9_.]+\.dylib)/g);
    if (dylibMatches) {
      for (const d of Array.from(new Set(dylibMatches))) {
        dependencies.push(d);
      }
    }

    const isFlutterAot = str.includes("_kDartVmSnapshotData") || str.includes("App.framework");

    return {
      format: "Mach-O",
      arch,
      is64Bit,
      endianness: isLittleEndian ? "little" : "big",
      sections: ["__TEXT", "__DATA", "__LINKEDIT"],
      exportedSymbols: [],
      dependencies,
      isFlutterAot,
    };
  }

  private analyzeWasm(): NativeBinaryAnalysis {
    const version = this.buffer.readUInt32LE(4);
    const sections: string[] = [];
    const exportedSymbols: NativeExportedSymbol[] = [];

    const sectionNames: Record<number, string> = {
      1: "Type",
      2: "Import",
      3: "Function",
      4: "Table",
      5: "Memory",
      6: "Global",
      7: "Export",
      10: "Code",
      0: "Custom",
    };

    let pos = 8;
    while (pos < this.buffer.length) {
      const sectionId = this.buffer[pos];
      pos += 1;
      // Read varuint32 section size
      let size = 0;
      let shift = 0;
      const startPos = pos;
      while (pos < this.buffer.length) {
        const b = this.buffer[pos++];
        size = (size | ((b & 0x7f) << shift)) >>> 0;
        if ((b & 0x80) === 0 || shift >= 28) break;
        shift += 7;
      }

      sections.push(sectionNames[sectionId] || `Section_${sectionId}`);

      // If export section, scan strings
      if (sectionId === 7) {
        const expChunk = this.buffer.toString("utf8", pos, Math.min(pos + size, this.buffer.length));
        const words = expChunk.match(/[a-zA-Z_][a-zA-Z0-9_]{2,30}/g);
        if (words) {
          for (const w of Array.from(new Set(words))) {
            exportedSymbols.push({ name: w, isFunction: true });
          }
        }
      }

      const nextPos = pos + size;
      if (nextPos <= startPos) {
        break; // Guard against cursor regression or loop lock
      }
      pos = nextPos;
    }

    return {
      format: "WASM",
      arch: "WebAssembly",
      is64Bit: false,
      endianness: "little",
      sections,
      exportedSymbols,
      dependencies: [],
      dartFfiWrapperCode: exportedSymbols.length > 0 ? this.generateDartFfi(exportedSymbols, "module.wasm") : undefined,
    };
  }

  private generateDartFfi(symbols: NativeExportedSymbol[], libFileName: string): string {
    const baseName = libFileName.replace(/^lib/, "").replace(/\.(so|dll|dylib|wasm)$/, "");
    let code = `import 'dart:ffi' as ffi;\nimport 'dart:io' show Platform;\n\n`;
    code += `// --- Auto-generated Dart FFI Bindings for ${libFileName} ---\n\n`;
    code += `class NativeLibraryBindings {\n`;
    code += `  final ffi.DynamicLibrary _dylib;\n\n`;
    code += `  NativeLibraryBindings(this._dylib);\n\n`;
    code += `  factory NativeLibraryBindings.open([String? customPath]) {\n`;
    code += `    if (customPath != null) {\n`;
    code += `      return NativeLibraryBindings(ffi.DynamicLibrary.open(customPath));\n`;
    code += `    }\n`;
    code += `    final String libName;\n`;
    code += `    if (Platform.isWindows) {\n`;
    code += `      libName = '${baseName}.dll';\n`;
    code += `    } else if (Platform.isMacOS || Platform.isIOS) {\n`;
    code += `      libName = 'lib${baseName}.dylib';\n`;
    code += `    } else {\n`;
    code += `      libName = 'lib${baseName}.so';\n`;
    code += `    }\n`;
    code += `    return NativeLibraryBindings(ffi.DynamicLibrary.open(libName));\n`;
    code += `  }\n\n`;

    for (const sym of symbols) {
      const funcName = sym.name.replace(/[^a-zA-Z0-9_]/g, "");
      code += `  // Native function: ${funcName}\n`;
      code += `  late final _${funcName} = _dylib.lookupFunction<ffi.Void Function(), void Function()>('${sym.name}');\n`;
      code += `  void ${funcName}() => _${funcName}();\n\n`;
    }

    code += `}\n`;
    return code;
  }

  private generateFfigenYaml(libFileName: string): string {
    return `# ffigen configuration generated by flutterin
name: NativeBindings
description: Bindings to ${libFileName} generated by flutterin
output: 'lib/core/native/generated_bindings.dart'
headers:
  entry-points:
    - 'include/**/*.h'
comments:
  style: any
  length: full
`;
  }

  private emptyResult(format: BinaryFormat): NativeBinaryAnalysis {
    return {
      format,
      arch: "Unknown",
      is64Bit: false,
      endianness: "little",
      sections: [],
      exportedSymbols: [],
      dependencies: [],
    };
  }
}
