import { defaultConnectionString } from "@workspace-os/adapters";
import { buildServer } from "./build-server.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const { app, pool } = buildServer(defaultConnectionString(), true);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => pool.end());
  });
}

app.listen({ port, host }).catch((err: unknown) => {
  app.log.error(err);
  process.exitCode = 1;
});
