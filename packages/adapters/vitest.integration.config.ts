import { defineConfig } from "vitest/config";

/**
 * Integration tests hit a real Postgres instance (see
 * deploy/simple/docker-compose.yml) rather than a mock — kept separate from
 * the default `test` script so unit tests stay fast and don't require Docker.
 *
 * They share one database, so files run sequentially (no file parallelism):
 * otherwise two files racing to truncate/insert the same FK-related tables
 * deadlock or hit foreign-key violations. Each file resets the tables it
 * touches in its own beforeEach.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 15_000,
    fileParallelism: false,
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
