/**
 * Android Binary Resource Table (resources.arsc) Decoder
 * Pure TypeScript parser for RES_TABLE_TYPE (0x0002) global string pools.
 */

export class ArscParser {
  private buffer: Buffer;
  private globalStrings: string[] = [];

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  public isArsc(): boolean {
    if (this.buffer.length < 12) return false;
    const type = this.buffer.readUInt16LE(0);
    return type === 0x0002; // RES_TABLE_TYPE
  }

  public parseGlobalStrings(): string[] {
    if (!this.isArsc()) return [];
    const headerSize = this.buffer.readUInt16LE(2);
    let offset = headerSize;

    while (offset + 8 <= this.buffer.length) {
      const chunkType = this.buffer.readUInt16LE(offset);
      const chunkSize = this.buffer.readUInt32LE(offset + 4);
      if (chunkSize < 8 || offset + chunkSize > this.buffer.length) break;

      if (chunkType === 0x0001) {
        // RES_STRING_POOL_TYPE
        this.parseStringPool(offset);
        break;
      }
      offset += chunkSize;
    }

    return this.globalStrings;
  }

  private parseStringPool(startOffset: number): void {
    if (startOffset + 28 > this.buffer.length) return;
    const stringCount = this.buffer.readUInt32LE(startOffset + 8);
    const flags = this.buffer.readUInt32LE(startOffset + 16);
    const isUtf8 = (flags & (1 << 8)) !== 0;
    const stringsStart = startOffset + this.buffer.readUInt32LE(startOffset + 20);

    const offsets: number[] = [];
    for (let i = 0; i < Math.min(stringCount, 10000); i++) {
      if (startOffset + 28 + i * 4 + 4 > this.buffer.length) break;
      offsets.push(this.buffer.readUInt32LE(startOffset + 28 + i * 4));
    }

    this.globalStrings = [];
    for (const relOffset of offsets) {
      const strOffset = stringsStart + relOffset;
      if (strOffset >= this.buffer.length) continue;

      if (isUtf8) {
        let pos = strOffset;
        if ((this.buffer[pos] & 0x80) !== 0) pos += 2;
        else pos += 1;
        if (pos >= this.buffer.length) continue;

        let byteLen = this.buffer[pos];
        if ((byteLen & 0x80) !== 0) {
          if (pos + 1 >= this.buffer.length) continue;
          byteLen = ((byteLen & 0x7f) << 8) | this.buffer[pos + 1];
          pos += 2;
        } else {
          pos += 1;
        }
        const s = this.buffer.toString("utf8", pos, Math.min(pos + byteLen, this.buffer.length));
        if (s) this.globalStrings.push(s);
      } else {
        let pos = strOffset;
        if (pos + 2 > this.buffer.length) continue;
        let charLen = this.buffer.readUInt16LE(pos);
        if ((charLen & 0x8000) !== 0) {
          if (pos + 4 > this.buffer.length) continue;
          charLen = ((charLen & 0x7fff) << 16) | this.buffer.readUInt16LE(pos + 2);
          pos += 4;
        } else {
          pos += 2;
        }
        const s = this.buffer.toString("utf16le", pos, Math.min(pos + charLen * 2, this.buffer.length));
        if (s) this.globalStrings.push(s);
      }
    }
  }
}
