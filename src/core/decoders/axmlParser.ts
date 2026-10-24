/**
 * Android Binary XML (AXML) Decoder
 * Pure TypeScript decoder for compiled Android XML files (AndroidManifest.xml, res/layout/*.xml)
 * Magic header: 0x00080003 (CHUNK_AXML_FILE)
 */

export interface AxmlAttribute {
  namespaceUri: string;
  name: string;
  value: string;
  resourceId?: number;
}

export interface AxmlNode {
  name: string;
  namespacePrefix?: string;
  namespaceUri?: string;
  attributes: Record<string, string>;
  attributeList: AxmlAttribute[];
  children: AxmlNode[];
  text?: string;
  lineNumber?: number;
}

const CHUNK_AXML_FILE = 0x00080003;
const CHUNK_STRING_POOL = 0x001c0001;
const CHUNK_RESOURCE_IDS = 0x00080180;
const CHUNK_START_NAMESPACE = 0x00100100;
const CHUNK_END_NAMESPACE = 0x00100101;
const CHUNK_START_TAG = 0x00100102;
const CHUNK_END_TAG = 0x00100103;
const CHUNK_TEXT = 0x00100104;

export class AxmlParser {
  private buffer: Buffer;
  private offset = 0;
  private stringPool: string[] = [];
  private resourceIds: number[] = [];

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  public isAxml(): boolean {
    if (this.buffer.length < 8) return false;
    const magic = this.buffer.readUInt32LE(0);
    return magic === CHUNK_AXML_FILE;
  }

  public parse(): AxmlNode {
    if (!this.isAxml()) {
      throw new Error(`Invalid AXML magic: 0x${this.buffer.readUInt32LE(0).toString(16)}. Expected 0x00080003.`);
    }

    this.offset = 8; // Skip magic (4) and file size (4)
    const rootStack: AxmlNode[] = [];
    let rootNode: AxmlNode | null = null;
    const namespaces: Map<string, string> = new Map(); // prefix -> uri

    while (this.offset < this.buffer.length) {
      if (this.offset + 8 > this.buffer.length) break;

      const chunkType = this.buffer.readUInt32LE(this.offset);
      const chunkSize = this.buffer.readUInt32LE(this.offset + 4);

      if (chunkSize < 8 || this.offset + chunkSize > this.buffer.length) {
        break; // Corrupted chunk or end
      }

      switch (chunkType) {
        case CHUNK_STRING_POOL:
          this.parseStringPool(this.offset);
          break;

        case CHUNK_RESOURCE_IDS:
          this.parseResourceIds(this.offset, chunkSize);
          break;

        case CHUNK_START_NAMESPACE: {
          if (this.offset + 24 <= this.buffer.length) {
            const prefixIdx = this.buffer.readInt32LE(this.offset + 16);
            const uriIdx = this.buffer.readInt32LE(this.offset + 20);
            const prefix = prefixIdx >= 0 && prefixIdx < this.stringPool.length ? this.stringPool[prefixIdx] : "";
            const uri = uriIdx >= 0 && uriIdx < this.stringPool.length ? this.stringPool[uriIdx] : "";
            namespaces.set(prefix, uri);
          }
          break;
        }

        case CHUNK_END_NAMESPACE:
          // End namespace scope
          break;

        case CHUNK_START_TAG: {
          if (this.offset + 36 <= this.buffer.length) {
            const lineNumber = this.buffer.readUInt32LE(this.offset + 8);
            const uriIdx = this.buffer.readInt32LE(this.offset + 16);
            const nameIdx = this.buffer.readInt32LE(this.offset + 20);
            const attrCount = this.buffer.readUInt16LE(this.offset + 28);

            const tagName = nameIdx >= 0 && nameIdx < this.stringPool.length ? this.stringPool[nameIdx] : "Unknown";
            const tagUri = uriIdx >= 0 && uriIdx < this.stringPool.length ? this.stringPool[uriIdx] : "";

            const attributes: Record<string, string> = {};
            const attributeList: AxmlAttribute[] = [];

            let attrOffset = this.offset + 36;
            for (let i = 0; i < attrCount; i++) {
              if (attrOffset + 20 > this.buffer.length) break;

              const attrUriIdx = this.buffer.readInt32LE(attrOffset);
              const attrNameIdx = this.buffer.readInt32LE(attrOffset + 4);
              const rawValIdx = this.buffer.readInt32LE(attrOffset + 8);
              const typedDataType = this.buffer.readUInt8(attrOffset + 15);
              const typedData = this.buffer.readUInt32LE(attrOffset + 16);

              const attrUri = attrUriIdx >= 0 && attrUriIdx < this.stringPool.length ? this.stringPool[attrUriIdx] : "";
              const attrName = attrNameIdx >= 0 && attrNameIdx < this.stringPool.length ? this.stringPool[attrNameIdx] : `attr_${i}`;

              let attrValue = "";
              if (rawValIdx >= 0 && rawValIdx < this.stringPool.length) {
                attrValue = this.stringPool[rawValIdx];
              } else {
                attrValue = this.formatTypedValue(typedDataType, typedData);
              }

              const prefix = attrUri ? this.getPrefixForUri(namespaces, attrUri) : "";
              const qualifiedName = prefix ? `${prefix}:${attrName}` : attrName;

              attributes[qualifiedName] = attrValue;
              attributeList.push({
                namespaceUri: attrUri,
                name: attrName,
                value: attrValue,
                resourceId: attrNameIdx < this.resourceIds.length ? this.resourceIds[attrNameIdx] : undefined,
              });

              attrOffset += 20;
            }

            const node: AxmlNode = {
              name: tagName,
              namespaceUri: tagUri,
              attributes,
              attributeList,
              children: [],
              lineNumber,
            };

            if (rootStack.length > 0) {
              rootStack[rootStack.length - 1].children.push(node);
            } else {
              rootNode = node;
            }
            rootStack.push(node);
          }
          break;
        }

        case CHUNK_END_TAG: {
          rootStack.pop();
          break;
        }

        case CHUNK_TEXT: {
          if (this.offset + 20 <= this.buffer.length) {
            const textIdx = this.buffer.readInt32LE(this.offset + 16);
            if (textIdx >= 0 && textIdx < this.stringPool.length && rootStack.length > 0) {
              rootStack[rootStack.length - 1].text = this.stringPool[textIdx];
            }
          }
          break;
        }
      }

      this.offset += chunkSize;
    }

    if (!rootNode) {
      throw new Error("No root element found in AXML file");
    }

    return rootNode;
  }

  private parseStringPool(startOffset: number): void {
    if (startOffset + 28 > this.buffer.length) return;
    const stringCount = this.buffer.readUInt32LE(startOffset + 8);
    const flags = this.buffer.readUInt32LE(startOffset + 16);
    const isUtf8 = (flags & (1 << 8)) !== 0;
    const stringsStart = startOffset + this.buffer.readUInt32LE(startOffset + 20);

    const offsets: number[] = [];
    for (let i = 0; i < stringCount; i++) {
      if (startOffset + 28 + i * 4 + 4 > this.buffer.length) break;
      offsets.push(this.buffer.readUInt32LE(startOffset + 28 + i * 4));
    }

    this.stringPool = [];
    for (let i = 0; i < offsets.length; i++) {
      const strOffset = stringsStart + offsets[i];
      if (strOffset >= this.buffer.length) {
        this.stringPool.push("");
        continue;
      }

      if (isUtf8) {
        // UTF-8 string format: [char_count_varint, byte_count_varint, utf8_bytes, \0]
        let pos = strOffset;
        if (pos >= this.buffer.length) { this.stringPool.push(""); continue; }
        // Skip char length varint
        if ((this.buffer[pos] & 0x80) !== 0) pos += 2;
        else pos += 1;

        if (pos >= this.buffer.length) { this.stringPool.push(""); continue; }
        // Read byte length varint
        let byteLen = this.buffer[pos];
        if ((byteLen & 0x80) !== 0) {
          if (pos + 1 >= this.buffer.length) { this.stringPool.push(""); continue; }
          byteLen = ((byteLen & 0x7f) << 8) | this.buffer[pos + 1];
          pos += 2;
        } else {
          pos += 1;
        }

        const str = this.buffer.toString("utf8", pos, Math.min(pos + byteLen, this.buffer.length));
        this.stringPool.push(str);
      } else {
        // UTF-16 string format: [char_count_varint, utf16le_bytes, \0\0]
        let pos = strOffset;
        if (pos + 2 > this.buffer.length) { this.stringPool.push(""); continue; }
        let charLen = this.buffer.readUInt16LE(pos);
        if ((charLen & 0x8000) !== 0) {
          if (pos + 4 > this.buffer.length) { this.stringPool.push(""); continue; }
          charLen = ((charLen & 0x7fff) << 16) | this.buffer.readUInt16LE(pos + 2);
          pos += 4;
        } else {
          pos += 2;
        }

        const byteLen = charLen * 2;
        const str = this.buffer.toString("utf16le", pos, Math.min(pos + byteLen, this.buffer.length));
        this.stringPool.push(str);
      }
    }
  }

  private parseResourceIds(startOffset: number, chunkSize: number): void {
    const count = Math.floor((chunkSize - 8) / 4);
    this.resourceIds = [];
    for (let i = 0; i < count; i++) {
      if (startOffset + 8 + i * 4 + 4 > this.buffer.length) break;
      this.resourceIds.push(this.buffer.readUInt32LE(startOffset + 8 + i * 4));
    }
  }

  private getPrefixForUri(namespaces: Map<string, string>, uri: string): string {
    for (const [prefix, nsUri] of namespaces.entries()) {
      if (nsUri === uri) return prefix;
    }
    if (uri.includes("android")) return "android";
    if (uri.includes("app") || uri.includes("res-auto")) return "app";
    return "";
  }

  private formatTypedValue(type: number, data: number): string {
    switch (type) {
      case 0x03: // TYPE_STRING
        return data < this.stringPool.length ? this.stringPool[data] : `str_${data}`;
      case 0x10: // TYPE_INT_DEC
        return data.toString();
      case 0x11: // TYPE_INT_HEX
        return `0x${data.toString(16)}`;
      case 0x12: // TYPE_INT_BOOLEAN
        return data !== 0 ? "true" : "false";
      case 0x1c: // TYPE_INT_COLOR_ARGB8
      case 0x1d: // TYPE_INT_COLOR_RGB8
      case 0x1e: // TYPE_INT_COLOR_ARGB4
      case 0x1f: // TYPE_INT_COLOR_RGB4
        return `#${data.toString(16).padStart(8, "0")}`;
      case 0x05: { // TYPE_DIMENSION
        const unit = ["px", "dp", "sp", "pt", "in", "mm"][data & 0x0f] || "dp";
        const radixShifts = [0, 7, 15, 23];
        const radix = (data >> 4) & 0x03;
        const mantissa = (data & 0xffffff00) >> 8; // preserve sign bit
        const val = mantissa / (1 << radixShifts[radix]);
        const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.?0+$/, "");
        return `${formatted}${unit}`;
      }
      case 0x01: // TYPE_REFERENCE
        return `@0x${data.toString(16)}`;
      default:
        return data.toString();
    }
  }

  private static escapeXml(val: string): string {
    return val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  public toXml(node: AxmlNode, indent = 0): string {
    const spaces = "  ".repeat(indent);
    const attrs = Object.entries(node.attributes)
      .map(([k, v]) => `${k}="${AxmlParser.escapeXml(v)}"`)
      .join(" ");

    const openTag = attrs ? `<${node.name} ${attrs}` : `<${node.name}`;

    if (node.children.length === 0 && !node.text) {
      return `${spaces}${openTag} />\n`;
    }

    let out = `${spaces}${openTag}>\n`;
    if (node.text) {
      out += `${spaces}  ${AxmlParser.escapeXml(node.text)}\n`;
    }
    for (const child of node.children) {
      out += this.toXml(child, indent + 1);
    }
    out += `${spaces}</${node.name}>\n`;
    return out;
  }
}
