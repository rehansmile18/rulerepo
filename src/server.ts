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

  const dayMs = 24 * 60 * 60 * 1000;
  const interval = setInterval(() => {
    activateScheduledPolicies().catch((err) => console.error("activateScheduledPolicies failed", err));
  }, dayMs);

  process.on("SIGTERM", () => {
    clearInterval(interval);
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
