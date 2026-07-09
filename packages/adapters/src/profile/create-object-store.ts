import type { ObjectStore } from "@workspace-os/core";
import { FilesystemObjectStore } from "../object-store/filesystem-object-store.js";
import type { Profile } from "./profile.js";
import { UnsupportedProfileAdapterError } from "./unsupported-profile-adapter-error.js";

export function createObjectStore(
  profile: Profile,
  env: Record<string, string | undefined> = process.env,
  override?: ObjectStore,
): ObjectStore {
  if (override) return override;

  switch (profile) {
    case "simple":
      return new FilesystemObjectStore(env.OBJECT_STORE_ROOT ?? "./.data/objects");
    case "hardened":
      // Epic 15: hardened deployments need an S3-compatible ObjectStore.
      // Not built yet — fail closed rather than silently using the
      // filesystem adapter in a bank deployment.
      throw new UnsupportedProfileAdapterError("ObjectStore", profile);
  }
}
