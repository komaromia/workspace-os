import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import {
  InvalidObjectKeyError,
  ObjectNotFoundError,
  type ObjectPutOptions,
  type ObjectStore,
} from "@workspace-os/core";

export class FilesystemObjectStore implements ObjectStore {
  constructor(private readonly root: string) {}

  async put(key: string, data: Uint8Array | string, _opts?: ObjectPutOptions): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Uint8Array> {
    const path = this.resolveKey(key);
    try {
      return new Uint8Array(await readFile(path));
    } catch (err) {
      if (isErrnoException(err) && err.code === "ENOENT") {
        throw new ObjectNotFoundError(key);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const path = this.resolveKey(key);
    await rm(path, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    const path = this.resolveKey(key);
    try {
      await stat(path);
      return true;
    } catch (err) {
      if (isErrnoException(err) && err.code === "ENOENT") {
        return false;
      }
      throw err;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const results: string[] = [];
    await this.walk(this.root, results);
    return results.filter((key) => key.startsWith(prefix)).sort();
  }

  private async walk(dir: string, results: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (isErrnoException(err) && err.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walk(fullPath, results);
      } else {
        results.push(relative(this.root, fullPath).split(sep).join("/"));
      }
    }
  }

  private resolveKey(key: string): string {
    if (isAbsolute(key) || key.split(/[\\/]/).includes("..")) {
      throw new InvalidObjectKeyError(key);
    }
    return join(this.root, key);
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
