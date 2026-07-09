import { customType, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
