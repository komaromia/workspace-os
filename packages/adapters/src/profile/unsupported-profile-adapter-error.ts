export class UnsupportedProfileAdapterError extends Error {
  constructor(
    public readonly adapter: string,
    public readonly profile: string,
  ) {
    super(`no ${adapter} adapter is wired for the "${profile}" profile yet`);
    this.name = "UnsupportedProfileAdapterError";
  }
}
