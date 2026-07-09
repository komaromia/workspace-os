export interface SandboxRunOptions {
  image: string;
  command: string[];
  env?: Record<string, string>;
  networkAccess?: boolean;
  timeoutMs?: number;
}

export interface SandboxRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SandboxRunner {
  run(options: SandboxRunOptions): Promise<SandboxRunResult>;
}
