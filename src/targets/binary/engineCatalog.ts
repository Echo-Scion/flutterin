import { readFile } from "node:fs/promises";

export interface EngineMetadata {
  flutterVersion: string;
  engineCommit: string;
  snapshotHash: string;
  dartVersion?: string;
  flavor?: "vanilla" | "shorebird" | "profile";
}

/**
 * Native Engine Version Catalog.
 * Maps binary snapshot hashes and engine commit IDs to Flutter & Dart release versions.
 */
export class EngineCatalog {
  private static cache: EngineMetadata[] | null = null;

  public static async load(): Promise<EngineMetadata[]> {
    if (this.cache) return this.cache;
    const url = new URL("./engineCatalogData.json", import.meta.url);
    const content = await readFile(url, "utf-8");
    this.cache = JSON.parse(content) as EngineMetadata[];
    return this.cache;
  }

  public static async getAllEngines(): Promise<EngineMetadata[]> {
    return this.load();
  }

  public static async findBySnapshotHash(hash: string): Promise<EngineMetadata | null> {
    const list = await this.load();
    const cleanHash = hash.toLowerCase().trim();
    return list.find((e) => e.snapshotHash.toLowerCase() === cleanHash) || null;
  }

  public static async findByCommit(commit: string): Promise<EngineMetadata | null> {
    const list = await this.load();
    const cleanCommit = commit.toLowerCase().trim();
    return list.find((e) => e.engineCommit.toLowerCase().startsWith(cleanCommit)) || null;
  }

  public static async findByVersion(version: string): Promise<EngineMetadata[]> {
    const list = await this.load();
    const cleanVer = version.toLowerCase().trim();
    return list.filter((e) => e.flutterVersion.toLowerCase().includes(cleanVer));
  }
}
