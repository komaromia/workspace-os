import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret");

    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("produces a salted hash — never stores the plaintext", async () => {
    const hash = await hashPassword("s3cret");

    expect(hash).not.toContain("s3cret");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");

    expect(a).not.toBe(b);
    await expect(verifyPassword("same", a)).resolves.toBe(true);
    await expect(verifyPassword("same", b)).resolves.toBe(true);
  });

  it("returns false for a malformed stored hash rather than throwing", async () => {
    await expect(verifyPassword("x", "not-a-valid-hash")).resolves.toBe(false);
    await expect(verifyPassword("x", "")).resolves.toBe(false);
  });
});
