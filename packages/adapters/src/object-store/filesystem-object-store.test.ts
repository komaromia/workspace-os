import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidObjectKeyError, ObjectNotFoundError } from "@workspace-os/core";
import { FilesystemObjectStore } from "./filesystem-object-store.js";

describe("FilesystemObjectStore", () => {
  let root: string;
  let store: FilesystemObjectStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "workspace-os-object-store-"));
    store = new FilesystemObjectStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("round-trips a string value written with put and read with get", async () => {
    await store.put("docs/hello.txt", "hello world");

    const data = await store.get("docs/hello.txt");

    expect(Buffer.from(data).toString("utf8")).toBe("hello world");
  });

  it("round-trips binary data", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    await store.put("bin/data", bytes);

    const data = await store.get("bin/data");

    expect(Array.from(data)).toEqual(Array.from(bytes));
  });

  it("creates intermediate directories implied by the key", async () => {
    await store.put("a/b/c/d.txt", "nested");

    expect(await store.exists("a/b/c/d.txt")).toBe(true);
  });

  it("throws ObjectNotFoundError when getting a missing key", async () => {
    await expect(store.get("does/not/exist")).rejects.toThrow(ObjectNotFoundError);
  });

  it("reports exists() as false for a missing key and true after put", async () => {
    expect(await store.exists("maybe.txt")).toBe(false);

    await store.put("maybe.txt", "now it's here");

    expect(await store.exists("maybe.txt")).toBe(true);
  });

  it("delete removes an object and is idempotent for a missing key", async () => {
    await store.put("gone.txt", "bye");

    await store.delete("gone.txt");
    expect(await store.exists("gone.txt")).toBe(false);

    await expect(store.delete("gone.txt")).resolves.not.toThrow();
  });

  it("list returns keys under a prefix, sorted, and excludes non-matching keys", async () => {
    await store.put("reports/2026/jan.txt", "a");
    await store.put("reports/2026/feb.txt", "b");
    await store.put("reports/2025/dec.txt", "c");
    await store.put("other/file.txt", "d");

    const keys = await store.list("reports/2026/");

    expect(keys).toEqual(["reports/2026/feb.txt", "reports/2026/jan.txt"]);
  });

  it("rejects keys that attempt to escape the store root via ..", async () => {
    await expect(store.put("../escape.txt", "nope")).rejects.toThrow(InvalidObjectKeyError);
    await expect(store.get("../escape.txt")).rejects.toThrow(InvalidObjectKeyError);
  });

  it("rejects absolute-path keys", async () => {
    await expect(store.put("/etc/passwd", "nope")).rejects.toThrow(InvalidObjectKeyError);
  });
});
