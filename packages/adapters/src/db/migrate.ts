import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, defaultConnectionString } from "./connection.js";

export async function runMigrations(connectionString = defaultConnectionString()): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
if (isMain) {
  runMigrations()
    .then(() => {
      console.log("migrations applied");
    })
    .catch((err: unknown) => {
      console.error("migration failed", err);
      process.exitCode = 1;
    });
}
