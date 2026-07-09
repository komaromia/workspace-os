export type Profile = "simple" | "hardened";

export class InvalidProfileError extends Error {
  constructor(public readonly value: string) {
    super(`invalid profile: "${value}" (expected "simple" or "hardened")`);
    this.name = "InvalidProfileError";
  }
}

/**
 * Deny-by-default: any value other than the two known profiles throws,
 * rather than silently falling back to a guess.
 */
export function resolveProfile(env: Record<string, string | undefined> = process.env): Profile {
  const value = env.PROFILE ?? "simple";
  if (value !== "simple" && value !== "hardened") {
    throw new InvalidProfileError(value);
  }
  return value;
}
