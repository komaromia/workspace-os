import { describe, expect, it } from "vitest";
import { EnvSecretsBroker } from "../secrets-broker/env-secrets-broker.js";
import { createSecretsBroker } from "./create-secrets-broker.js";

describe("createSecretsBroker", () => {
  it("returns an EnvSecretsBroker reading from the given env for the simple profile", async () => {
    const broker = createSecretsBroker("simple", { API_KEY: "abc" });

    expect(broker).toBeInstanceOf(EnvSecretsBroker);
    await expect(broker.get("API_KEY")).resolves.toBe("abc");
  });

  it("applies SECRETS_PREFIX from env when present, for either profile", async () => {
    const broker = createSecretsBroker("hardened", {
      SECRETS_PREFIX: "WSOS_SECRET_",
      WSOS_SECRET_DB_PASSWORD: "hunter2",
    });

    await expect(broker.get("DB_PASSWORD")).resolves.toBe("hunter2");
  });

  it("returns an injected override regardless of profile", async () => {
    const override = new EnvSecretsBroker({ ONLY: "here" });

    const broker = createSecretsBroker("simple", {}, override);

    expect(broker).toBe(override);
    await expect(broker.get("ONLY")).resolves.toBe("here");
  });
});
