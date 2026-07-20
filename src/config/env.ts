import "dotenv/config";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

// Known insecure placeholder values shipped in .env.example / docker-compose defaults.
// Allowed for local/dev/test convenience, but must never reach production.
const INSECURE_DEFAULTS = new Set([
  "dev-secret-change-me",
  "change-me-in-production",
  "change-me-immediately",
]);

/**
 * Resolves a secret env var. In production a missing value, or a value that is one of the
 * known public placeholders, hard-fails startup — so a deploy that forgets to set real
 * secrets refuses to boot instead of silently accepting forged tokens / seeding a public admin.
 * Outside production the dev fallback is used for convenience.
 */
function resolveSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (!value) {
    if (isProduction) throw new Error(`${name} must be set in production (no fallback allowed)`);
    return devFallback;
  }
  if (isProduction && INSECURE_DEFAULTS.has(value)) {
    throw new Error(`${name} is set to a known insecure default; set a real value before running in production`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/tlm_rule_repository",
  jwtSecret: resolveSecret("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  nodeEnv,
  isProduction,
  // Maker-checker control for global (statutory) policy approvals: when true, the user who
  // approves a global policy must differ from the user who submitted it for approval.
  // Defaults to true (real compliance behavior); set to false only for solo dev/demo use.
  requireApprovalSeparation: process.env.REQUIRE_APPROVAL_SEPARATION !== "false",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
  // Resolved lazily by the seed script (not here) so the app itself boots without it; the seed
  // script enforces a real password in production via resolveSeedAdminPassword below.
  seedAdminPasswordRaw: process.env.SEED_ADMIN_PASSWORD,
};

/** Used only by the seed script — hard-fails in production if the admin password is missing or a public default. */
export function resolveSeedAdminPassword(): string {
  return resolveSecret("SEED_ADMIN_PASSWORD", "change-me-immediately");
}
