import { SecretNotFoundError, type SecretsBroker } from "@workspace-os/core";

export interface EnvSecretsBrokerOptions {
  prefix?: string;
}

export class EnvSecretsBroker implements SecretsBroker {
  private readonly prefix: string;

  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    opts: EnvSecretsBrokerOptions = {},
  ) {
    this.prefix = opts.prefix ?? "";
  }

  async get(name: string): Promise<string> {
    const value = await this.tryGet(name);
    if (value === null) {
      throw new SecretNotFoundError(name);
    }
    return value;
  }

  async tryGet(name: string): Promise<string | null> {
    const value = this.env[`${this.prefix}${name}`];
    return value ?? null;
  }
}
