import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Explicit signature: promisify(scrypt) has ambiguous overloads (the options
// form), so pin it to the (password, salt, keylen) => Promise<Buffer> shape.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;
const KEY_LEN = 64;

/**
 * Hashes a password with scrypt and a per-password random salt. The stored
 * form is `scrypt$<saltHex>$<hashHex>` so verification is self-contained — no
 * separate salt column. scrypt is memory-hard, so this deliberately is not the
 * fastest primitive available; that is the point for password storage.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const derived = await scryptAsync(password, salt, expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
