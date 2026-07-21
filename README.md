# TLM Rule Repository

Backend service for the TLM (Time & Labor Management) platform's Rule Repository: stores every
US labor compliance policy (overtime, meal break, shift differential, etc.) as versioned,
effective-dated data, lets clients bundle policies into Rule Groups, assign them to a workforce
population, and resolve which rules apply to a given employee on a given date.

See the architecture write-up for the full design rationale (polymorphic policy collection,
global vs. client policies, maker-checker approvals, tenant isolation).

## Requirements

- Node.js 20+
- MongoDB 6+ (local install, Docker, or Atlas)

## Quick start (local Node + local/Docker MongoDB)

```bash
npm install
cp .env.example .env        # edit if you're not using the defaults

# Start MongoDB if you don't already have one running (bound to localhost only):
docker run -d --name tlm-mongo -p 127.0.0.1:27017:27017 mongo:7

npm run seed                # creates the first PLATFORM_ADMIN (see .env for its credentials)
npm run seed:demo           # optional: populates realistic demo data (clients, policies, rule groups)

npm run dev                 # starts the API on http://localhost:4000
```

Check it's up:

```bash
curl http://localhost:4000/health
```

## Quick start (Docker Compose — API + MongoDB together)

```bash
docker compose up -d --build
```

This brings up a **secure-by-default local stack**: MongoDB runs with authentication enabled and
is bound to `127.0.0.1` only, the API connects with credentials, and the API is likewise bound to
`127.0.0.1:4000`. It is **not** seeded automatically — no accounts exist until you seed, so no
well-known demo passwords are ever created just by starting the stack.

Bootstrap the first real admin (uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):

```bash
docker compose exec api node dist/utils/seed.js
```

Or, for local exploration only, load the full demo dataset (⚠️ creates accounts with the public
passwords listed below — local use only):

```bash
docker compose exec api node dist/utils/seedDemoData.js
```

The API is then available at `http://localhost:4000`.

> The Compose file runs as `NODE_ENV=development` so the placeholder secrets work out of the box.
> To run it as a real deployment, set `NODE_ENV=production` **and** provide a real `JWT_SECRET`
> plus `MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD` (e.g. in a `.env` file) — the app refuses to
> boot on placeholder secrets outside development/test.

## Environment variables

See `.env.example`. Notable ones:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signing secret for auth tokens — change before any non-local use |
| `REQUIRE_APPROVAL_SEPARATION` | When `true` (default), a global policy's approver must differ from its submitter (real maker-checker). Set `false` for solo dev/demo use |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials for the first admin created by `npm run seed` |

## Seeding data

Three scripts, for three different situations — all seed the *same* demo dataset/credentials,
so it doesn't matter which one you use, and running one after another is safe (each checks for
the demo client and skips if it's already there):

- **`npm run seed`** — bootstraps only the single production `PLATFORM_ADMIN` account, from
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. No demo data. This is the minimum needed to start
  using the API for real: log in as this user, then create clients and additional users through
  the API itself.
- **`npm run seed:demo`** — a Node script (goes through the real service layer — policy
  create/submit/approve, rule group publish, etc. — so it's exercised the same way the API is)
  that populates a full illustrative dataset: 2 platform admins, 2 demo clients (each with their
  own admin user), a published global policy for all 10 policy types, a Rule Group per client,
  and assignments that demonstrate specificity-based resolution (state-wide vs. an
  employee-specific override). Prints all the login credentials and ready-to-run example
  requests when it finishes. Requires the Node app's dependencies (`npm install`), but not a
  running server.
- **`scripts/mongo-init.js`** — the same dataset, but as a plain MongoDB script with no Node/npm
  involved at all: just indexes and `insertMany` calls. Useful if you want the database seeded
  before the app exists in any runnable form (inspecting it directly with Compass/mongosh). It is
  **not** wired into any automatic Docker init hook — a plain `docker compose up` never runs it —
  so starting the stack never creates the well-known demo accounts. Run it manually against a
  local database with:
  ```bash
  mongosh "mongodb://localhost:27017/tlm_rule_repository" scripts/mongo-init.js
  ```
  Or into the running Compose stack (which requires auth) on purpose:
  ```bash
  docker compose exec -T mongo mongosh \
    "mongodb://tlm_root:local-dev-only-change-me@localhost:27017/tlm_rule_repository?authSource=admin" \
    < scripts/mongo-init.js
  ```
  ⚠️ Demo/local exploration only — it seeds accounts whose passwords are public (documented
  below). Never run it against a production, staging, or network-reachable database. Its user
  passwords are pre-hashed with bcrypt (cost factor 10) since mongosh has no bcrypt available.

Run `npm run seed:demo` (or the mongosh script) against a fresh **local** database if you just
want to try the API without wiring up your own data first.

## Getting a token

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"change-me-immediately"}'
```

Use the returned `token` as `Authorization: Bearer <token>` on every other request.

If you seeded demo data instead, log in as one of these (also printed at the end of whichever
seed script you ran):

| Account | Email | Password |
|---|---|---|
| Platform admin (maker) | `demo-admin@tlm.dev` | `Demo-Admin-Pass1!` |
| Platform admin (checker) | `demo-checker@tlm.dev` | `Demo-Checker-Pass1!` |
| Acme Retail admin | `acme-admin@tlm.dev` | `Acme-Admin-Pass1!` |
| Bolt Logistics admin | `bolt-admin@tlm.dev` | `Bolt-Admin-Pass1!` |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build (`dist/server.js`) |
| `npm run typecheck` | Type-check `src/` and `tests/` with no emit |
| `npm test` | Run the automated test suite (spins up ephemeral in-memory MongoDB instances — no external database needed) |
| `npm run seed` | Bootstrap the first `PLATFORM_ADMIN` |
| `npm run seed:demo` | Populate illustrative demo data |

## Project layout

```
src/
  config/        env + MongoDB connection
  models/        Mongoose schemas — policy.model.ts is the polymorphic base;
                  models/policies/*.model.ts are the per-type discriminators
  modules/        one folder per resource: policy, ruleGroup, assignment, client,
                  auditLog, auth, user — each with validators/service/controller/routes
  middleware/     auth, tenant scoping, request validation, error handling
  jobs/           scheduled effective-date housekeeping
  utils/          seed.ts (prod bootstrap) and seedDemoData.ts (Node-based demo data)
tests/            vitest + supertest integration tests, one MongoMemoryServer per file
scripts/          mongo-init.js — raw MongoDB demo-data setup, no Node required
ci/               ci.yml — GitHub Actions pipeline (see "Continuous integration" below)
```

## Continuous integration

The GitHub Actions pipeline (typecheck → test → build on every push/PR) lives at
[`ci/ci.yml`](ci/ci.yml). To activate it, move it into the Actions path:

```bash
mkdir -p .github/workflows && git mv ci/ci.yml .github/workflows/ci.yml
git commit -m "Enable CI workflow" && git push
```

It is kept outside `.github/workflows/` in the repo so the initial upload could be pushed with a
token that lacks the GitHub `workflow` scope. Pushing it into the Actions path requires a token
with that scope (or adding the file via the GitHub web UI).

## Notes on what's illustrative vs. production-ready

The rule *content* for every policy type (thresholds, waiver conditions, penalty amounts) is
illustrative, written to exercise the architecture — it has not been reviewed by a compliance or
legal function and should not be treated as legally accurate before real use. Everything else
(the API, the versioning/approval lifecycle, tenant isolation, tests) is real and verified.

## Security defaults

- **Secrets fail closed.** Outside an explicit `NODE_ENV=development`/`test`, the app refuses to
  boot on a missing or placeholder `JWT_SECRET` (and `SEED_ADMIN_PASSWORD` for the seed script).
- **JWT algorithm pinned** to HS256 on both sign and verify.
- **Tenant isolation on assignments**: an assignment can only reference a rule group owned by the
  same client, and resolution is scoped to the caller's own client — a client can't bind or read
  another tenant's rule group via a known `ruleGroupId`.
- **Rate limiting**: a global per-IP limiter across the API, plus a tighter one on `/auth/login`.
- **Least-privilege listing**: only admins can enumerate the user roster; pagination and rule-group
  size are bounded to blunt resource-exhaustion.
- **Compose stack is secure by default**: MongoDB requires auth and binds to localhost, the API
  binds to localhost, and no demo accounts are auto-created. Demo data is always an explicit opt-in.
