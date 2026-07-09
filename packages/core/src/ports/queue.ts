export interface QueueMessage<T> {
  id: string;
  payload: T;
  attempts: number;
}

/**
 * A claimed message must never be visible to a second claim() while it is
 * outstanding — see Epic 5 (shared work board), which relies on this for
 * `FOR UPDATE SKIP LOCKED` claim semantics so two agents never grab the same
 * work item.
 */
export interface Queue<T> {
  enqueue(payload: T): Promise<string>;
  claim(): Promise<QueueMessage<T> | null>;
  complete(id: string): Promise<void>;
  fail(id: string, error: string): Promise<void>;
}
