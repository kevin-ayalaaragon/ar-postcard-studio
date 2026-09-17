# 0003 - Prisma ORM, SQLite for dev / Postgres for prod, pinned to the 6.x line

## Status
Accepted

## Context and Problem Statement
Postcards need a real record (sender/recipient/message/status/asset
paths), not just files on disk, so status ("submitted" vs "AR assets
attached and ready") can be queried and the admin dashboard can list
pending work.

## Decision Drivers
- Type-safe queries matching the TypeScript stack.
- Zero-infra local dev (no Docker/Postgres server required just to run
  `npm run dev`), with a clean path to a real Postgres instance in
  production.
- Stability over bleeding-edge: this is a resume artifact that should
  still build in six months, not a testbed for a library's newest major.

## Considered Options
1. Prisma ORM.
2. Drizzle ORM.
3. Raw SQL via a query builder (e.g. Kysely) or a hand-rolled `sqlite3`/`pg` client.

## Decision Outcome
Prisma, using the SQLite provider in dev (`prisma/dev.db`, gitignored)
and swapping `DATABASE_URL` to Postgres in prod via `prisma migrate
deploy`. Pinned to **6.19.3**, not the `latest` npm dist-tag, which at
build time resolved to **8.0.0-rc.15** - an unreleased major with a
breaking config-file format change (datasource URLs move out of
`schema.prisma` into a separate `prisma.config.ts`, and the client
generator/output path changed). That's not "conventional best practice"
for a project meant to stay buildable; 6.x is Prisma's last stable major
and uses the schema format most documentation and tooling still assumes.

### Consequences
- Positive: standard `schema.prisma` + `@prisma/client` workflow, well
  documented, matches what most current tutorials/job descriptions mean
  by "Prisma."
- Negative: will need a deliberate, scheduled upgrade to 7.x/8.x later
  once that major stabilizes and its docs/ecosystem catch up - tracked as
  future work, not silently deferred.

## Sources
- Prisma ORM official docs: https://www.prisma.io/docs/orm
- Prisma's own comparison of itself against a traditional ORM
  (Sequelize), supporting "Prisma is the conventional choice for a
  Node/TypeScript + relational DB app" framing:
  https://www.prisma.io/docs/orm/more/comparisons/prisma-and-sequelize
- Directly observed in this session: `npm view prisma dist-tags` on
  2026-09-17 showed `latest: 8.0.0-rc.15` and `prev: 7.10.0` (no stable
  8.x yet); running `prisma init`/`prisma migrate dev` against 7.10.0 in
  this repo failed with `P1012` because `datasource.url` in
  `schema.prisma` is no longer supported in that major - a live
  reproduction, not a secondhand claim.
