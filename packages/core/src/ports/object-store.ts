export interface ObjectPutOptions {
  contentType?: string;
}

export interface ObjectStore {
  put(key: string, data: Uint8Array | string, opts?: ObjectPutOptions): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
}

export class ObjectNotFoundError extends Error {
  constructor(public readonly key: string) {
    super(`object not found: ${key}`);
    this.name = "ObjectNotFoundError";
  }
}

export class InvalidObjectKeyError extends Error {
  constructor(public readonly key: string) {
    super(`invalid object key: ${key}`);
    this.name = "InvalidObjectKeyError";
  }
}
