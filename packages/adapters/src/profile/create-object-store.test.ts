import { describe, expect, it } from "vitest";
import { FilesystemObjectStore } from "../object-store/filesystem-object-store.js";
import { createObjectStore } from "./create-object-store.js";
import { UnsupportedProfileAdapterError } from "./unsupported-profile-adapter-error.js";

describe("createObjectStore", () => {
  it("returns a FilesystemObjectStore for the simple profile", () => {
    const store = createObjectStore("simple", { OBJECT_STORE_ROOT: "/tmp/wsos-objects" });

    expect(store).toBeInstanceOf(FilesystemObjectStore);
  });

  it("defaults the filesystem root when OBJECT_STORE_ROOT is unset", () => {
    const store = createObjectStore("simple", {});

    expect(store).toBeInstanceOf(FilesystemObjectStore);
  });

  it("throws UnsupportedProfileAdapterError for the hardened profile (no adapter built yet)", () => {
    expect(() => createObjectStore("hardened", {})).toThrow(UnsupportedProfileAdapterError);
  });

  it("returns an injected override regardless of profile, including hardened", () => {
    const override = new FilesystemObjectStore("/tmp/wsos-override");

    expect(createObjectStore("hardened", {}, override)).toBe(override);
    expect(createObjectStore("simple", {}, override)).toBe(override);
  });
});
