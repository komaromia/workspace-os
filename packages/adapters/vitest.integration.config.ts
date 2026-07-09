import { defineConfig } from "vitest/config";

/**
 * Integration tests hit a real Postgres instance (see
 * deploy/simple/docker-compose.yml) rather than a mock — kept separate from
 * the default `test` script so unit tests stay fast and don't require Docker.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 15_000,
  },
});
