import * as fs from "node:fs/promises";
import * as path from "node:path";

import { CacheCategory } from "./Constants";

type Address = string;

type Shape = Record<string, Record<string, unknown>>;

type ShapeRoot = Shape & Record<Address, { hash: string }>;
export type ShapeGuageToPool = Shape &
  Record<Address, { poolAddress: Address }>;
export type ShapeBribeToPool = Shape &
  Record<Address, { poolAddress: Address }>;
export type ShapeToken = Shape &
  Record<Address, { decimals: number; name: string; symbol: string }>;

// biome-ignore lint/complexity/noStaticOnlyClass:
export class Cache {
  static async init<C = CacheCategory>(
    category: C,
    chainId: number | string | bigint,
  ) {
    if (!Object.values(CacheCategory).find((c) => c === category)) {
      throw new Error("Unsupported cache category");
    }

    type S = C extends "token"
      ? ShapeToken
      : C extends "guageToPool"
        ? ShapeGuageToPool
        : C extends "bribeToPool"
          ? ShapeBribeToPool
          : ShapeRoot;
    const entry = new Entry<S>(`${category}-${chainId.toString()}`);
    await entry.init();
    return entry;
  }
}

export class Entry<T extends Shape> {
  private memory: Shape = {};

  static encoding = "utf8" as const;
  static folder = "./.cache" as const;

  public readonly key: string;
  public readonly file: string;

  constructor(key: string) {
    this.key = key;
    this.file = Entry.resolve(key);
  }

  public read(key: string) {
    const memory = this.memory || {};
    return memory[key] as T[typeof key];
  }

  public async load() {
    try {
      const data = await fs.readFile(this.file, Entry.encoding);
      this.memory = JSON.parse(data) as T;
    } catch (error) {
      console.error(error);
      this.memory = {};
    }
  }

  public add<N extends T>(fields: N) {
    if (!this.memory || Object.values(this.memory).length === 0) {
      this.memory = fields;
    } else {
      for (const key of Object.keys(fields)) {
        if (!this.memory[key]) {
          this.memory[key] = {};
        }
        for (const nested of Object.keys(fields[key])) {
          this.memory[key][nested] = fields[key][nested];
        }
      }
    }

    this.publish();
  }

  public async init() {
    await this.preflight();
    await this.load();
  }

  private async preflight() {
    // Ensure cache folder exists
    try {
      await fs.mkdir(Entry.folder, { recursive: true });
    } catch (err) {
      console.error("Failed to create cache folder:", err);
      // Optionally rethrow or handle as needed
    }

    // Ensure cache file exists
    try {
      await fs.access(this.file);
    } catch {
      // File does not exist, create it
      try {
        await fs.writeFile(this.file, JSON.stringify({}), { flag: "wx" });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
          console.error("Failed to create cache file:", err);
        }
        // If EEXIST, another process created it in the meantime; that's fine
      }
    }
  }

  private async publish() {
    const prepared = JSON.stringify(
      this.memory,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    );
    try {
      await fs.writeFile(this.file, prepared);
    } catch (error) {
      console.error(error);
    }
  }

  static resolve(key: string) {
    return path.join(Entry.folder, key.toLowerCase().concat(".json"));
  }
}
