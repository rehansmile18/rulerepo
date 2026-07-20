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

# Start MongoDB if you don't already have one running:
docker run -d --name tlm-mongo -p 27017:27017 mongo:7

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

That's it — on a fresh volume, MongoDB automatically runs `scripts/mongo-init.js` on its first
boot (via `docker-entrypoint-initdb.d`) and the database comes up already seeded with demo data
(see [Seeding data](#seeding-data)). The API is then available at `http://localhost:4000`.

If you'd rather start empty and seed manually, or you're pointing at a volume that already has
data, run:

```bash
docker compose exec api npm run seed
docker compose exec api npm run seed:demo
```

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
  before the app exists in any runnable form (inspecting it directly with Compass/mongosh), or
  in the Docker Compose flow above, where MongoDB runs it itself on first boot. Run it manually
  with:
  ```bash
  mongosh "mongodb://localhost:27017/tlm_rule_repository" scripts/mongo-init.js
  ```
  Its user passwords are pre-hashed with bcrypt (cost factor 10) since mongosh has no bcrypt
  available — the plaintext passwords are the same ones documented below and printed by
  `seed:demo`.

Run `npm run seed:demo` (or the mongosh script) against a fresh database if you just want to try
the API without wiring up your own data first.

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
