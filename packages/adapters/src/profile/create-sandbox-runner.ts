import type { SandboxRunner } from "@workspace-os/core";
import { DockerSandboxRunner } from "../sandbox/docker-sandbox-runner.js";
import type { Profile } from "./profile.js";

export function createSandboxRunner(profile: Profile, override?: SandboxRunner): SandboxRunner {
  if (override) return override;
  switch (profile) {
    case "simple":
      return new DockerSandboxRunner();
    case "hardened":
      // gVisor for kernel-level isolation of untrusted, model-generated code.
      return new DockerSandboxRunner({ runtime: "runsc" });
  }
}
