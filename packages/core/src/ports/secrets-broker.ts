export interface SecretsBroker {
  get(name: string): Promise<string>;
  tryGet(name: string): Promise<string | null>;
}

export class SecretNotFoundError extends Error {
  constructor(public readonly name: string) {
    super(`secret not found: ${name}`);
    this.name = "SecretNotFoundError";
  }
}
