import type { SecretsBroker } from "@workspace-os/core";
import { EnvSecretsBroker } from "../secrets-broker/env-secrets-broker.js";
import type { Profile } from "./profile.js";

/**
 * Both profiles read secrets from the process environment: in the simple
 * profile they're set directly; in the hardened profile they're expected to
 * be injected into the environment by the bank's own vault/KMS tooling
 * (e.g. a secrets-CSI mount), namespaced with SECRETS_PREFIX. If a future
 * hardened deployment needs a broker that talks to a vault API directly
 * instead, pass it via `override`.
 */
export function createSecretsBroker(
  _profile: Profile,
  env: Record<string, string | undefined> = process.env,
  override?: SecretsBroker,
): SecretsBroker {
  if (override) return override;
  return new EnvSecretsBroker(env, { prefix: env.SECRETS_PREFIX ?? "" });
}
