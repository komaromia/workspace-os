import { describe, expect, it } from "vitest";
import { InvalidProfileError, resolveProfile } from "./profile.js";

describe("resolveProfile", () => {
  it("defaults to simple when PROFILE is unset", () => {
    expect(resolveProfile({})).toBe("simple");
  });

  it("returns simple when PROFILE=simple", () => {
    expect(resolveProfile({ PROFILE: "simple" })).toBe("simple");
  });

  it("returns hardened when PROFILE=hardened", () => {
    expect(resolveProfile({ PROFILE: "hardened" })).toBe("hardened");
  });

  it("throws InvalidProfileError for an unrecognized value, denying by default", () => {
    expect(() => resolveProfile({ PROFILE: "staging" })).toThrow(InvalidProfileError);
  });

  it("throws InvalidProfileError for an empty string", () => {
    expect(() => resolveProfile({ PROFILE: "" })).toThrow(InvalidProfileError);
  });
});
