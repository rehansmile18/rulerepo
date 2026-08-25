import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    globals: false,
    // Each test file that calls setupTestContext() spawns its own real mongod process
    // (mongodb-memory-server), so the databases are already isolated per file. What is NOT
    // isolated is the machine: running every file at once means that many concurrent mongod
    // processes competing for CPU and file descriptors, which surfaces as rare, non-deterministic
    // request failures (a "socket hang up", a unique index not finished building). Capping
    // concurrency removes that contention — matching tlm-backend and tlm-punch-processor, which
    // both already cap at the same number for the same reason.
    maxWorkers: 4,
  },
});
