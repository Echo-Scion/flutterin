/**
 * Electron ASAR Archive Unpacker
 * Pure TypeScript decoder for Electron app.asar bundles
 * Reads Chromium Pickle header and file manifest to extract files without external CLI dependencies.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export interface AsarEntry {
  path: string;
  size: number;
  offset: number;
  isDirectory: boolean;
  isExecutable?: boolean;
}

export interface AsarHeaderFileNode {
  size?: number;
  offset?: string | number;
  executable?: boolean;
  unpacked?: boolean;
  files?: Record<string, AsarHeaderFileNode>;
}

export interface AsarHeader {
  files: Record<string, AsarHeaderFileNode>;
}

export class AsarUnpacker {
  private buffer: Buffer;
  private header: AsarHeader | null = null;
  private headerSize = 0;
  private dataOffset = 0;
  private asarPath?: string;

  constructor(bufferOrPath: Buffer | string) {
    if (typeof bufferOrPath === "string") {
      this.asarPath = path.resolve(bufferOrPath);
      this.buffer = fs.readFileSync(bufferOrPath);
    } else {
      this.buffer = bufferOrPath;
    }
    this.readHeader();
  }

  public static isAsar(buffer: Buffer): boolean {
    if (buffer.length < 16) return false;
    // Pickle format: [uint32: 4, uint32: payload_size, uint32: header_size, uint32: json_len]
    const u0 = buffer.readUInt32LE(0);
    const u1 = buffer.readUInt32LE(4);
    const u2 = buffer.readUInt32LE(8);
    const u3 = buffer.readUInt32LE(12);

    return u0 === 4 && u1 > 0 && u2 > 0 && u3 > 0 && u3 <= u2;
  }

  private readHeader(): void {
    if (!AsarUnpacker.isAsar(this.buffer)) {
      throw new Error("Invalid ASAR archive format or header");
    }

    // Byte 0-3: UInt32LE = 4
    // Byte 4-7: UInt32LE = pickle payload size
    // Byte 8-11: UInt32LE = header size
    // Byte 12-15: UInt32LE = json string length
    const jsonLen = this.buffer.readUInt32LE(12);
    const picklePayloadSize = this.buffer.readUInt32LE(4);
    if (16 + jsonLen > this.buffer.length || 8 + picklePayloadSize > this.buffer.length) {
      throw new Error("Corrupted ASAR archive: header length exceeds buffer bounds");
    }
    const jsonStr = this.buffer.toString("utf8", 16, 16 + jsonLen);

    this.header = JSON.parse(jsonStr) as AsarHeader;
    this.headerSize = 8 + picklePayloadSize;
    this.dataOffset = this.headerSize;
  }

  public getManifest(): AsarHeader {
    if (!this.header) throw new Error("Header not initialized");
    return this.header;
  }

  public listEntries(): AsarEntry[] {
    if (!this.header) return [];
    const entries: AsarEntry[] = [];

    const walk = (node: Record<string, AsarHeaderFileNode>, currentPath: string) => {
      for (const [name, fileNode] of Object.entries(node)) {
        const itemPath = currentPath ? `${currentPath}/${name}` : name;
        if (fileNode.files) {
          entries.push({
            path: itemPath,
            size: 0,
            offset: 0,
            isDirectory: true,
          });
          walk(fileNode.files, itemPath);
        } else {
          const offsetNum = typeof fileNode.offset === "string" ? parseInt(fileNode.offset, 10) : (fileNode.offset || 0);
          entries.push({
            path: itemPath,
            size: fileNode.size || 0,
            offset: offsetNum,
            isDirectory: false,
            isExecutable: fileNode.executable,
          });
        }
      }
    };

    walk(this.header.files, "");
    return entries;
  }

  public readFile(relativePath: string): Buffer {
    const cleanPath = relativePath.replace(/\\/g, "/").replace(/^\//, "");
    const parts = cleanPath.split("/");

    let current = this.header?.files;
    let targetNode: AsarHeaderFileNode | undefined;

    for (let i = 0; i < parts.length; i++) {
      if (!current) break;
      const part = parts[i];
      if (i === parts.length - 1) {
        targetNode = current[part];
      } else {
        current = current[part]?.files;
      }
    }

    if (!targetNode || targetNode.files) {
      throw new Error(`File not found in ASAR: ${relativePath}`);
    }

    if (targetNode.unpacked) {
      if (this.asarPath) {
        const unpackedRoot = path.resolve(`${this.asarPath}.unpacked`);
        const unpackedPath = path.resolve(unpackedRoot, cleanPath);
        if (unpackedPath.startsWith(unpackedRoot + path.sep) && fs.existsSync(unpackedPath)) {
          return fs.readFileSync(unpackedPath);
        }
      }
      return Buffer.alloc(0);
    }

    const offsetNum = typeof targetNode.offset === "string" ? parseInt(targetNode.offset, 10) : (targetNode.offset || 0);
    const size = targetNode.size || 0;
    const start = this.dataOffset + offsetNum;
    const end = start + size;

    if (end > this.buffer.length) {
      throw new Error(`Offset out of bounds for ${relativePath}: start=${start}, size=${size}, total=${this.buffer.length}`);
    }

    return this.buffer.subarray(start, end);
  }

  public async extractAll(targetDir: string): Promise<string[]> {
    const entries = this.listEntries();
    const extractedFiles: string[] = [];
    const resolvedBase = path.resolve(targetDir);

    for (const entry of entries) {
      const fullPath = path.resolve(resolvedBase, entry.path);
      if (!fullPath.startsWith(resolvedBase + path.sep) && fullPath !== resolvedBase) {
        continue;
      }
      if (entry.isDirectory) {
        fs.mkdirSync(fullPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        const content = this.readFile(entry.path);
        fs.writeFileSync(fullPath, content);
        extractedFiles.push(entry.path);
      }
    }

    return extractedFiles;
  }
}
