import mongoose from "mongoose";
import { env } from "./env";

export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);

  // Surface connection lifecycle so a dropped DB is visible in logs rather than silent.
  mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));

  return mongoose.connect(env.mongoUri, {
    // Fail fast on first boot if Mongo isn't reachable yet, so the process exits and the
    // orchestrator's restart policy retries — rather than hanging indefinitely.
    serverSelectionTimeoutMS: 10_000,
  });
}
