# 0009 - Single Postgres datasource (drop the SQLite-dev split from 0003)

## Status
Accepted. Supersedes the "SQLite dev / Postgres prod" half of
[0003](0003-database-orm.md); that ADR's ORM choice (Prisma, pinned 6.x)
still stands.

## Context and Problem Statement
0003 planned dev on SQLite and prod on Postgres, switched at deploy time
by changing `DATABASE_URL`. That's not something Prisma actually supports:
`datasource.provider` is a fixed literal (`"sqlite"` vs `"postgresql"`),
not something `env()` can select, and the migration files already
generated against the sqlite provider use SQLite-specific SQL (e.g.
`DATETIME`, `PRAGMA`-driven defaults) that fails outright against
Postgres. First real attempt to deploy to a Postgres production database
would have hit this at the worst possible time - mid-deploy, not during
review.

## Decision Drivers
- Must actually be deployable; this is going live, not staying a local demo.
- Preserve 0003's original goal (no local Postgres server required just to
  run `npm run dev`) if possible, rather than dropping it outright.
- Avoid schema/migration drift between what's tested locally and what
  runs in production.

## Considered Options
1. Maintain two schema files (`schema.prisma` for SQLite dev,
   `schema.prod.prisma` for Postgres), selected via `--schema` per command.
2. Single Postgres datasource everywhere; use a free hosted Postgres
   branch for local dev instead of SQLite, so no local server is needed.
3. Single Postgres datasource everywhere; require Docker Compose locally.

## Decision Outcome
Option 2. `prisma/schema.prisma`'s datasource is now `postgresql` only.
Local dev points `DATABASE_URL` at a free Neon branch (see
[0010](0010-hosting-vercel-neon-r2.md)) instead of a local file - this
keeps 0003's "no Docker/Postgres server to install" goal intact, gets
exact dev/prod schema and migration parity (the actual Twelve-Factor
"dev/prod parity" principle already cited in 0006, not just an aspiration
toward it), and matches the pattern Prisma's own docs and current
community guidance converge on for this exact SQLite-dev/Postgres-prod
situation. Option 1 was rejected: Prisma doesn't document or support
dual-provider schemas as a maintained pattern, migration files still
can't be shared between the two files, and it adds an ongoing
synchronization burden for a problem option 2 removes outright. Option 3
was rejected as unnecessary given a free hosted option meets the same
"no local infra" goal.

### Consequences
- Positive: one schema, one set of migrations, no dialect drift between
  environments; local dev now exercises the real production database
  engine.
- Negative: local dev requires network access to Neon (no fully offline
  dev loop); acceptable for this project's scale.
- The migration generated against the old `sqlite` provider
  (`prisma/migrations/20260917181452_init/`) was deleted rather than kept
  as dead weight - it cannot run against Postgres. The real initial
  migration is (re)generated via `prisma migrate dev` once a live Neon
  dev branch exists.

## Sources
- Prisma ORM docs, Schema Reference - `provider` is a required, static
  string field on `datasource`, not an environment-resolved value:
  https://www.prisma.io/docs/orm/reference/prisma-schema-reference#datasource
- Prisma Migrate - "Limitations and known issues": migrations are
  provider-specific and not portable between database providers:
  https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues
- The Twelve-Factor App, "Dev/prod parity": keep development and
  production as similar as possible, explicitly naming "backing services"
  (e.g. the database) as something that should match, not just resemble,
  across environments - already the justification cited in 0006 for this
  project's storage abstraction: https://12factor.net/dev-prod-parity
