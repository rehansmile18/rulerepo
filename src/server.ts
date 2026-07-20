import mongoose from "mongoose";
import { createApp } from "./app";
import { connectDb } from "./config/db";
import { env } from "./config/env";
import { activateScheduledPolicies } from "./jobs/activateScheduledPolicies";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`TLM Rule Repository API listening on port ${env.port}`);
  });

  const runHousekeeping = () =>
    activateScheduledPolicies().catch((err) => console.error("activateScheduledPolicies failed", err));

  // Run once on boot so effective-date transitions aren't delayed until the first interval tick
  // (and so short-lived / frequently-restarted instances still make progress).
  void runHousekeeping();
  const interval = setInterval(runHousekeeping, 24 * 60 * 60 * 1000);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);
    clearInterval(interval);
    // Hard-exit backstop if a connection refuses to drain.
    const forceExit = setTimeout(() => {
      console.error("Shutdown timed out; forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();
    server.close(async () => {
      await mongoose.disconnect().catch(() => undefined);
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
