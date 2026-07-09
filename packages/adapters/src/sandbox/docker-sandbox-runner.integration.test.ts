import { describe, expect, it } from "vitest";
import { DockerSandboxRunner } from "./docker-sandbox-runner.js";

const IMAGE = "alpine:3.20";

// These exercise real container isolation, so they need Docker + the alpine
// image. Kept in the integration suite (not the docker-free unit suite).
describe("DockerSandboxRunner (requires Docker)", () => {
  const runner = new DockerSandboxRunner();

  it("runs a command and captures stdout with exit code 0", async () => {
    const result = await runner.run({ image: IMAGE, command: ["echo", "hello-sandbox"] });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello-sandbox");
  });

  it("propagates a non-zero exit code", async () => {
    const result = await runner.run({ image: IMAGE, command: ["sh", "-c", "exit 7"] });

    expect(result.exitCode).toBe(7);
  });

  it("passes environment variables into the container", async () => {
    const result = await runner.run({
      image: IMAGE,
      command: ["sh", "-c", "echo $FOO"],
      env: { FOO: "bar-value" },
    });

    expect(result.stdout.trim()).toBe("bar-value");
  });

  it("denies network access by default", async () => {
    // With --network=none there is no route out; the fetch fails and we fall
    // through to the marker.
    const result = await runner.run({
      image: IMAGE,
      command: ["sh", "-c", "wget -T 3 -q -O- http://1.1.1.1 || echo NETWORK_DENIED"],
    });

    expect(result.stdout).toContain("NETWORK_DENIED");
  });

  it("runs with a read-only root filesystem but a writable /tmp", async () => {
    const result = await runner.run({
      image: IMAGE,
      command: [
        "sh",
        "-c",
        "(touch /rootfile 2>/dev/null && echo ROOT_WRITABLE) || echo ROOT_READONLY; " +
          "(touch /tmp/ok 2>/dev/null && echo TMP_WRITABLE) || echo TMP_READONLY",
      ],
    });

    expect(result.stdout).toContain("ROOT_READONLY");
    expect(result.stdout).toContain("TMP_WRITABLE");
  });

  it("drops all Linux capabilities", async () => {
    // CapEff (effective capabilities) in /proc/self/status is all zeros when
    // every capability is dropped.
    const result = await runner.run({
      image: IMAGE,
      command: ["sh", "-c", "grep CapEff /proc/self/status"],
    });

    expect(result.stdout).toMatch(/CapEff:\s+0000000000000000/);
  });

  it("enforces a timeout, returning promptly with a non-zero exit", async () => {
    const start = Date.now();
    const result = await runner.run({
      image: IMAGE,
      command: ["sh", "-c", "sleep 30"],
      timeoutMs: 2000,
    });
    const elapsed = Date.now() - start;

    expect(result.exitCode).not.toBe(0);
    expect(elapsed).toBeLessThan(15_000);
  });
});
