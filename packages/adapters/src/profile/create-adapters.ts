import type { ObjectStore, Queue, SecretsBroker } from "@workspace-os/core";
import type { Pool } from "pg";
import { createObjectStore } from "./create-object-store.js";
import { createQueue } from "./create-queue.js";
import { createSecretsBroker } from "./create-secrets-broker.js";
import type { Profile } from "./profile.js";
import { resolveProfile } from "./profile.js";

export interface Adapters {
  profile: Profile;
  objectStore: ObjectStore;
  secretsBroker: SecretsBroker;
  createQueue<T>(queueName: string): Queue<T>;
}

export interface AdapterOverrides {
  objectStore?: ObjectStore;
  secretsBroker?: SecretsBroker;
}

/**
 * Resolves the active profile from env and wires up every adapter it
 * selects. This is the seam described in ADR 0002: swapping "simple" for
 * "hardened" is a config change here, not a rewrite of anything that
 * depends on these interfaces.
 */
export function createAdapters(
  pool: Pool,
  env: Record<string, string | undefined> = process.env,
  overrides: AdapterOverrides = {},
): Adapters {
  const profile = resolveProfile(env);
  return {
    profile,
    objectStore: createObjectStore(profile, env, overrides.objectStore),
    secretsBroker: createSecretsBroker(profile, env, overrides.secretsBroker),
    createQueue: (queueName) => createQueue(pool, queueName, profile),
  };
}
