@AGENTS.md

## Claude Code
- Tests: `npm test`; one file: `npx vitest run tests/<file>.test.ts`. They mock the database and set their own env in `tests/setup.ts`, so they need no `.env` or Postgres.
- Lint: `npm run lint`. Typecheck: `npx tsc --noEmit`.
- Schema changes go through a new Prisma migration; never edit an existing folder in `prisma/migrations/`.
