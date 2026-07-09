import { describe, expect, it } from "vitest";
import type { SandboxRunner } from "@workspace-os/core";
import { DockerSandboxRunner } from "../sandbox/docker-sandbox-runner.js";
import { createSandboxRunner } from "./create-sandbox-runner.js";

describe("createSandboxRunner", () => {
  it("returns a Docker sandbox runner for the simple profile", () => {
    expect(createSandboxRunner("simple")).toBeInstanceOf(DockerSandboxRunner);
  });

  it("returns a Docker sandbox runner (gVisor runtime) for the hardened profile", () => {
    // Both profiles use Docker; hardened selects a kernel-isolating runtime.
    expect(createSandboxRunner("hardened")).toBeInstanceOf(DockerSandboxRunner);
  });

  it("returns an injected override regardless of profile", () => {
    const override: SandboxRunner = {
      async run() {
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    };
    expect(createSandboxRunner("hardened", override)).toBe(override);
    expect(createSandboxRunner("simple", override)).toBe(override);
  });
});
