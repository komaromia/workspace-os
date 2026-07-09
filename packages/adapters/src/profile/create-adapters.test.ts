import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemObjectStore } from "../object-store/filesystem-object-store.js";
import { PostgresQueue } from "../queue/postgres-queue.js";
import { EnvSecretsBroker } from "../secrets-broker/env-secrets-broker.js";
import { createAdapters } from "./create-adapters.js";
import { UnsupportedProfileAdapterError } from "./unsupported-profile-adapter-error.js";

describe("createAdapters", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = new Pool({ connectionString: "postgres://unused/unused" });
  });

  afterEach(async () => {
    await pool.end();
  });

  it("resolves the profile from env and wires up simple-profile adapters", () => {
    const adapters = createAdapters(pool, { PROFILE: "simple" });

    expect(adapters.profile).toBe("simple");
    expect(adapters.objectStore).toBeInstanceOf(FilesystemObjectStore);
    expect(adapters.secretsBroker).toBeInstanceOf(EnvSecretsBroker);
    expect(adapters.createQueue("work")).toBeInstanceOf(PostgresQueue);
  });

  it("propagates a hardened-profile ObjectStore gap instead of masking it", () => {
    expect(() => createAdapters(pool, { PROFILE: "hardened" })).toThrow(
      UnsupportedProfileAdapterError,
    );
  });
});
