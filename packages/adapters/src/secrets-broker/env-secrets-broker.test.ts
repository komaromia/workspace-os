import { describe, expect, it } from "vitest";
import { SecretNotFoundError } from "@workspace-os/core";
import { EnvSecretsBroker } from "./env-secrets-broker.js";

describe("EnvSecretsBroker", () => {
  it("returns the value of a present env var via get()", async () => {
    const broker = new EnvSecretsBroker({ DB_PASSWORD: "hunter2" });

    await expect(broker.get("DB_PASSWORD")).resolves.toBe("hunter2");
  });

  it("throws SecretNotFoundError from get() for a missing var, without leaking any value", async () => {
    const broker = new EnvSecretsBroker({});

    await expect(broker.get("MISSING")).rejects.toThrow(SecretNotFoundError);
    await expect(broker.get("MISSING")).rejects.toThrow(/MISSING/);
  });

  it("tryGet returns the value when present", async () => {
    const broker = new EnvSecretsBroker({ API_KEY: "abc123" });

    await expect(broker.tryGet("API_KEY")).resolves.toBe("abc123");
  });

  it("tryGet returns null instead of throwing when the var is missing", async () => {
    const broker = new EnvSecretsBroker({});

    await expect(broker.tryGet("MISSING")).resolves.toBeNull();
  });

  it("applies a configured prefix when looking up names", async () => {
    const broker = new EnvSecretsBroker(
      { WSOS_SECRET_DB_PASSWORD: "hunter2" },
      { prefix: "WSOS_SECRET_" },
    );

    await expect(broker.get("DB_PASSWORD")).resolves.toBe("hunter2");
    await expect(broker.tryGet("DB_PASSWORD")).resolves.toBe("hunter2");
  });

  it("treats an empty string env var as present, not missing", async () => {
    const broker = new EnvSecretsBroker({ EMPTY: "" });

    await expect(broker.get("EMPTY")).resolves.toBe("");
    await expect(broker.tryGet("EMPTY")).resolves.toBe("");
  });
});
