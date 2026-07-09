import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
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

/**
 * Members — the single first-class principal (Epic 2). Humans and agents live
 * in one table; `type` distinguishes them without forking the schema. `roles`
 * is a jsonb string array in the simple profile; a normalized member_roles
 * table can replace it at scale without changing the domain model.
 */
export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    identityRef: text("identity_ref").notNull(),
    displayName: text("display_name").notNull(),
    roles: jsonb("roles").notNull().$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("members_identity_ref_idx").on(table.identityRef)],
);

/**
 * Persona versions — one row per (personaId, version). Versions are immutable
 * (Epic 2/16): a revision inserts a new row rather than updating an existing
 * one, so the full version history is retained for model governance.
 */
export const personaVersions = pgTable(
  "persona_versions",
  {
    personaId: text("persona_id").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    allowedTools: jsonb("allowed_tools").notNull().$type<string[]>().default([]),
    model: jsonb("model").notNull().$type<{
      modelId: string;
      temperature?: number;
      maxTokens?: number;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.personaId, table.version] })],
);

/**
 * Unified activity attribution (Epic 2): every recorded action carries the
 * acting member, regardless of human/agent type. The FK to members enforces
 * that attribution is to a real principal — a dangling actor is rejected at
 * the database, not silently recorded. Epic 4 layers tamper-evidence and
 * export on top of this same trail.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorMemberId: text("actor_member_id")
      .notNull()
      .references(() => members.id),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    metadata: jsonb("metadata").notNull().$type<Record<string, unknown>>().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activities_actor_idx").on(table.actorMemberId, table.occurredAt),
    index("activities_resource_idx").on(table.resourceType, table.resourceId, table.occurredAt),
  ],
);
