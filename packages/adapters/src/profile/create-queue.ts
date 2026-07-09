import type { Queue } from "@workspace-os/core";
import type { Pool } from "pg";
import { PostgresQueue } from "../queue/postgres-queue.js";
import type { Profile } from "./profile.js";

/**
 * Postgres backs the queue in both profiles (only its deployment location
 * differs, per Epic 15) — the profile parameter is accepted for symmetry
 * with the other adapter factories and so a profile-specific override
 * becomes a one-line change if that ever stops being true.
 */
export function createQueue<T>(pool: Pool, queueName: string, _profile: Profile): Queue<T> {
  return new PostgresQueue<T>(pool, queueName);
}
