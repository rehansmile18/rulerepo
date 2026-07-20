import bcrypt from "bcryptjs";
import { connectDb } from "../config/db";
import { env } from "../config/env";
import { User } from "../models/user.model";

async function main(): Promise<void> {
  await connectDb();

  const existing = await User.findOne({ email: env.seedAdminEmail.toLowerCase() });
  if (existing) {
    console.log(`Seed admin ${env.seedAdminEmail} already exists — nothing to do.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(env.seedAdminPassword, 12);
  await User.create({
    email: env.seedAdminEmail.toLowerCase(),
    passwordHash,
    role: "PLATFORM_ADMIN",
    clientId: null,
  });

  console.log(`Seeded initial PLATFORM_ADMIN user: ${env.seedAdminEmail}`);
  console.log("Log in with this account, then create additional users via POST /api/v1/users.");
  if (env.seedAdminPassword === "change-me-immediately") {
    console.warn("WARNING: using the default seed password — set SEED_ADMIN_PASSWORD before deploying anywhere real.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
