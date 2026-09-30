# 0012 - Vitest (node environment) for unit and route-handler tests

## Status
Accepted

## Context and Problem Statement
Until this decision the repo had no automated tests: CI ran
`prisma migrate deploy`, `npm run lint` and `npm run build` only. Two
production-affecting bugs had already been found and fixed by hand and
verified only with ad-hoc `curl` checks, so nothing stopped either from
coming back:

- [ADR-0011](0011-admin-mcp-server.md): the `/mcp` route forwarded the
  server's own `ADMIN_SECRET` for any caller (commit `acc62c8`).
- `baseUrl()` used `??`, so an empty-string `PUBLIC_BASE_URL` counted as
  set and every MCP tool call failed in production (commit `7e2d0aa`).

The project needs a test runner, a decision on what layer to test at, and
a place for it in CI.

## Decision Drivers
- Regression tests for the two fixed bugs above, plus the auth gate on
  every admin endpoint.
- Must run in CI with no secrets and no network, in seconds.
- Conventional, documented setup for this Next.js version
  (see `AGENTS.md`: read the bundled docs, not training data).
- The AR viewer needs a camera and a printed target, so it cannot be
  asserted in CI without a real device (the same limit documented in
  ar-birthday-postcard's README).

## Considered Options
1. Vitest in the `node` environment, calling route handlers directly.
2. Jest via `next/jest`.
3. Playwright end-to-end tests against a running instance.
4. Node's built-in test runner.

## Decision Outcome
Option 1. Tests live in `tests/`, run with `npm test` (`vitest run`), and
execute after lint and build in CI.

- Route handlers are plain `Request` -> `Response` functions in this
  codebase, so tests call them directly and need no server.
- **Prisma is mocked** (`vi.mock("@/lib/db")`): these tests cover route
  logic, not SQL. The checked-in migration is already validated against a
  real Postgres 16 service by the CI `prisma migrate deploy` step
  ([ADR-0009](0009-single-postgres-datasource.md)).
- **Storage is real**: the local disk driver writes to a per-run temp
  directory, so upload, read-back and path-traversal behavior are
  exercised for real.
- `environment: "node"` (not jsdom): nothing under test renders React
  components. Next.js's own guide recommends end-to-end tests, not unit
  tests, for `async` Server Components, and the AR viewer is out of scope
  here for the reason in the drivers above.
- `baseUrl()` moved from `src/app/mcp/route.ts` to `src/lib/base-url.ts`
  with no behavior change, so the `??`-vs-`||` regression is testable
  without importing the MCP handler.
- Path aliasing uses a one-line `resolve.alias` for `@` in
  `vitest.config.mts` instead of adding the `vite-tsconfig-paths` plugin
  the Next.js guide shows, to avoid a dependency for one alias. That
  substitution is a judgment call, not a sourced recommendation.
- `jsqr` (dev-only) decodes generated QR codes so tests assert the round
  trip (generate -> decode -> exact URL) on both the standalone QR and
  the composited postcard back.

### Consequences
- Positive: the two bug fixes and the admin auth matrix are now
  regression-tested; the suite runs in a few seconds.
- Negative: no test touches a real database or a real B2 bucket; the AR
  viewer and React pages are untested; and running the tests needs
  Node >= 22.12 (Vitest's requirement) although Next.js itself runs on
  20.9+. `@types/node` moved from `^20` to `^22` because Vitest 5's peer
  dependency range excludes 20.
- Options 2 and 4 were rejected on judgment, not on a sourced comparison:
  Vitest needs no Next-specific transform setup for plain TypeScript
  handlers. Flagged here as synthesis per
  [ADR-0000](0000-record-architecture-decisions.md).

## Sources
- Next.js, "Testing" overview (test types; the recommendation to use
  end-to-end tests for `async` Server Components; the four tools covered):
  https://nextjs.org/docs/app/guides/testing
- Next.js, "How to set up Vitest with Next.js" (manual setup, `test`
  script; read from the copy bundled with the installed Next.js 16.3.5 at
  `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`):
  https://nextjs.org/docs/app/guides/testing/vitest
- Vitest guide ("Vitest requires Vite >=v6.4.0 and Node >=v22.12.0";
  `vitest run` for a single non-watch run): https://vitest.dev/guide/
- Vitest configuration, `environment` (default `node`):
  https://vitest.dev/config/environment
