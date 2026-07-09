import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { SandboxRunner, SandboxRunOptions, SandboxRunResult } from "@workspace-os/core";

export interface DockerSandboxRunnerOptions {
  /** Container runtime — set to "runsc" for gVisor / a Kata runtime in the
   * hardened profile. Defaults to Docker's default runtime. */
  runtime?: string;
  memory?: string;
  cpus?: string;
  dockerBin?: string;
  /** Convention: exit code reported when a run is killed for exceeding its
   * timeout (mirrors coreutils `timeout`). */
  timeoutExitCode?: number;
}

const TIMEOUT_EXIT_CODE = 124;

/**
 * Runs agent-generated (untrusted) code in a per-task container — the single
 * most important security control (Epic 10). Every run drops all Linux
 * capabilities, forbids privilege escalation, uses a read-only root filesystem
 * with only a small writable /tmp, mounts nothing from the host, and denies
 * network by default. No host credentials are passed in. The container runtime
 * is configurable so the hardened profile can select gVisor/Kata for
 * kernel-level isolation.
 */
export class DockerSandboxRunner implements SandboxRunner {
  private readonly runtime?: string;
  private readonly memory: string;
  private readonly cpus: string;
  private readonly dockerBin: string;
  private readonly timeoutExitCode: number;

  constructor(options: DockerSandboxRunnerOptions = {}) {
    this.runtime = options.runtime;
    this.memory = options.memory ?? "256m";
    this.cpus = options.cpus ?? "1";
    this.dockerBin = options.dockerBin ?? "docker";
    this.timeoutExitCode = options.timeoutExitCode ?? TIMEOUT_EXIT_CODE;
  }

  run(options: SandboxRunOptions): Promise<SandboxRunResult> {
    const name = `wsos-sbx-${randomUUID()}`;
    const args = [
      "run",
      "--rm",
      "--name",
      name,
      "--cap-drop=ALL",
      "--security-opt",
      "no-new-privileges",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,size=64m",
      "--pids-limit",
      "256",
      "--memory",
      this.memory,
      "--cpus",
      this.cpus,
      // Default-deny network unless the task explicitly requests it.
      "--network",
      options.networkAccess ? "bridge" : "none",
    ];
    if (this.runtime) {
      args.push("--runtime", this.runtime);
    }
    for (const [key, value] of Object.entries(options.env ?? {})) {
      args.push("--env", `${key}=${value}`);
    }
    args.push(options.image, ...options.command);

    return new Promise<SandboxRunResult>((resolve) => {
      const child = spawn(this.dockerBin, args);
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const timer =
        options.timeoutMs !== undefined
          ? setTimeout(() => {
              timedOut = true;
              // Stop the container itself (killing the CLI alone wouldn't).
              spawn(this.dockerBin, ["rm", "-f", name]).on("error", () => {});
              child.kill("SIGKILL");
            }, options.timeoutMs)
          : undefined;

      child.on("error", (err) => {
        if (timer) clearTimeout(timer);
        resolve({ exitCode: -1, stdout, stderr: `${stderr}${String(err)}` });
      });

      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        resolve({
          exitCode: timedOut ? this.timeoutExitCode : (code ?? -1),
          stdout,
          stderr,
        });
      });
    });
  }
}
