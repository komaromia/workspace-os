import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * pgvector's `vector` type has no first-class drizzle-orm column builder as
 * of the version pinned here, so it's defined as a customType per Drizzle's
 * own documented pattern for extension types. Kept in this file (rather than
 * a sibling module) because drizzle-kit's config loader resolves schema
 * imports via plain Node `require` and does not follow this project's
 * NodeNext-style `.js`-suffixed relative imports across files.
 */
const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return config ? `vector(${config.dimensions})` : "vector";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    const trimmed = value.slice(1, -1);
    return trimmed.length === 0 ? [] : trimmed.split(",").map(Number);
  },
});

/**
 * Placeholder table proving the Postgres + pgvector + Drizzle pipeline works
 * end to end (Epic 1 acceptance). Replace with the real domain schema
 * (Member, WorkItem, Artifact, ...) as Epics 2/5/6 land.
 */
export const schemaBootstrapProbe = pgTable("_schema_bootstrap_probe", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  embedding: vector("embedding", { dimensions: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Backs the Postgres `Queue` adapter (Epic 5 claim semantics: `FOR UPDATE
 * SKIP LOCKED` so two workers never claim the same row). One table serves
 * every named queue, partitioned by `queueName`.
 */
export const queueMessages = pgTable(
  "queue_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueName: text("queue_name").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("queue_messages_claim_idx").on(table.queueName, table.status, table.createdAt)],
);
