# 0013 - Read-only, admin-only GraphQL API (Yoga + Pothos) beside the REST routes

## Status
Accepted

## Context and Problem Statement
The admin list has no pagination. `GET /api/admin/postcards` runs a bare
`findMany` ordered by `createdAt desc` and returns every postcard, and the
`/admin` dashboard fetches that whole list again after every upload. That
is fine at today's volume and gets worse with every submission.

Two readers use admin data: the human dashboard and agents. Agents reach
it through the MCP server ([ADR-0011](0011-admin-mcp-server.md)), whose
`list_pending_postcards` tool fetches the REST list and filters the full
array for `SUBMITTED` in memory. That tool needs the REST route to stay
unpaginated, so the REST route cannot simply grow pagination.

There is also a portfolio motive, stated openly: the owner wants a working,
defensible GraphQL service in this repo. For one table and one first-party
client, adding a `?cursor=` parameter to a new REST route, or tRPC, would
also have worked. The case for GraphQL here is narrower than "GraphQL is
better": it gives a **bounded, typed query surface that people and agents
can call safely**. The schema is the contract, and it is checked in. Clients
choose fields but cannot exceed fixed page-size, depth, breadth and cost
limits. Nothing in it can write.

## Decision Drivers
- Paginate the admin list without changing the REST response that the MCP
  tool depends on.
- A typed contract that is reviewed in diffs (`schema.graphql`) and cannot
  drift from the TypeScript types.
- Safe for an untrusted-but-authenticated caller (an agent): every request
  has a cost ceiling that is checked before any resolver runs.
- Nothing new to provision or pay for: same Neon database, no migration,
  same Vercel deployment ([ADR-0010](0010-hosting-vercel-neon-b2.md)).
- Same auth as every other admin surface ([ADR-0007](0007-admin-auth.md)).

## Considered Options
1. **GraphQL Yoga + Pothos (code-first), read-only, in a Next.js route
   handler beside the REST routes.**
2. tRPC.
3. `pg_graphql` (GraphQL generated inside Postgres).
4. Apollo Server with schema-first SDL.
5. Add `?cursor=&limit=` to a new REST route and stop there.

## Decision Outcome
Option 1, in `src/app/api/graphql/route.ts` with the schema in
`src/lib/graphql/schema.ts`.

- **Surface.** `postcards(status, first, after)` is a Relay-style
  connection: `first` defaults to 20, and values above 50 or below 1 are
  rejected with a clear error rather than silently clamped. `last`/`before`
  are rejected (forward pagination only). `postcard(slug)` returns one
  postcard or null. `PostcardStatus` is an enum. `Postcard` exposes file
  **URLs** (built with `fileUrl()`), not internal filesystem paths. The
  URL is `/api/files/<storage key>`, so it does contain the storage key.
- **Pagination is keyset, not offset.** Order is `createdAt desc, id desc`;
  `id` breaks ties so the order is total. The cursor is an opaque
  base64url of `createdAt|id`, and "after" becomes
  `createdAt < c OR (createdAt = c AND id < cid)`. The query takes
  `first + 1` rows and uses the extra row only for `hasNextPage`. Prisma's
  built-in `cursor` option was not used because it needs a unique field
  and would not preserve the `createdAt` order on its own.
- **Auth before parsing.** `isAuthorizedAdmin()` runs before Yoga sees the
  request, the same pattern as `/mcp`. A caller without the
  `x-admin-secret` header gets a bare 401 and no document is parsed,
  validated or resolved.
- **Cost limits.** `@pothos/plugin-complexity` caps depth (6), breadth
  (40 selections in the whole document) and total complexity (1000). A
  connection costs `1 + first x` its selection, with `first` clamped to
  1..50 for scoring so a negative `first` cannot cancel out other aliases
  (the plugin also floors multipliers at 0, but the clamp does not rely on
  that),
  and `edges` is set not to add the default list multiplier again. One 50-row page selecting every
  field costs 951 and passes; two in one request do not. Breadth stops
  alias amplification (60 aliased `postcard(slug)` lookups are 120
  selections). Pothos computes this from the document's shape when
  execution starts, before any root resolver runs. That is later than
  validation, which the plan assumed, but has the same effect: an
  over-limit request returns HTTP 200 with `errors` and every root field
  `null` (normal GraphQL semantics), and makes no database call. A full
  introspection query still fits, so GraphiQL and codegen keep working.
  The numbers are judgment calls sized to this schema.
- **Transport.** POST only for operations; batching off, so one request is
  one operation and the cost limit bounds the request. GET never executes:
  in development it serves GraphiQL (static HTML; its queries are POSTs
  that still need the header), elsewhere it returns 405.
- **Errors.** Yoga's `maskedErrors` turns unexpected errors (a database
  failure, say) into `"Unexpected error."`. Only deliberate `GraphQLError`s
  such as "Invalid cursor." keep their message.
- **No CSRF plugin; CORS off.** The custom `x-admin-secret` header forces
  a CORS preflight, which a cross-site form post or simple request cannot
  send. Yoga is configured with `cors: false` (no `Access-Control-*`
  headers on any response) and the route exports no `OPTIONS` handler, so
  that preflight is never approved, independent of Yoga's CORS defaults.
  Adding Yoga's CSRF prevention plugin would duplicate that.
- **Shared data access.** `src/lib/postcards.ts` holds the reads
  (`listPostcards`, `listAllPostcards`, `getPostcardBySlug`) and the admin
  mapping (`toAdminPostcard`). The REST admin list now calls
  `listAllPostcards()`, keeps its exact response shape, and stays
  unpaginated, which a test pins.
- **Dashboard.** Only the list read moved: `/admin` sends one fixed, typed
  query with a "Load more" button (plain `fetch`, no client library).
  Uploads stay on the REST route, and the refresh after an upload starts
  again from the first page.
- **Contract.** `npm run schema:print` writes the sorted SDL to
  `schema.graphql`. A test fails when the file is stale.

### Why not the others
- **tRPC** gives end-to-end types with less machinery, but only to
  TypeScript clients that import the router type. The second reader here
  is an agent over HTTP, and tRPC has no language-neutral schema to hand
  it or to review. Rejected on that judgment, not a sourced benchmark.
- **pg_graphql** builds the schema from database tables. That couples the
  API to the table layout, would expose storage path columns unless each
  is hidden, and moves authorization into Postgres roles and row-level
  security, a second auth system next to ADR-0007's. It is also a Postgres
  extension to enable on Neon, which breaks "nothing new provisioned".
- **Apollo Server** works, but Yoga runs on the Fetch API `Request` /
  `Response` that Next.js route handlers already use, with no adapter
  package. Schema-first SDL would also mean keeping SDL and TypeScript
  types in sync by hand or with a code generator; Pothos derives the SDL
  from the TypeScript.
- **REST pagination only** was the honest minimum and would have fixed
  the unpaginated list. It was not chosen because it gives no typed,
  reviewable contract and no field selection for agent callers, and the
  portfolio goal above is real.

### Consequences
- Positive: the dashboard pages through postcards instead of loading all
  of them; agents get a fixed-cost, read-only, typed query surface; and
  the REST routes and the MCP tool are unchanged.
- Positive: no new infrastructure, no migration, no new cost.
- Negative: a second API style to maintain beside REST, plus five
  runtime dependencies (`graphql`, `graphql-yoga`, `@pothos/core`,
  `@pothos/plugin-relay`, `@pothos/plugin-complexity`).
- Negative: `postcard(slug)` duplicates the public
  `GET /api/postcards/[slug]` but **includes sender PII** (`senderName`,
  `message`), which the public route deliberately omits. This is safe only
  because the whole endpoint is admin-only. There is no field-level
  authorization: anyone holding the admin secret sees every field.
- Negative: the tests mock Prisma ([ADR-0012](0012-vitest-testing.md)).
  They prove which `where`/`take` arguments a cursor produces and how
  `hasNextPage` is derived from the extra row; they do not prove the
  keyset query against a real Postgres.
- Negative: `graphql-yoga` 6 requires a newer Node 22 minor than Next.js
  does. `package.json` now declares an `engines` range and CI pins it (see
  below); the Vercel project's Node setting must satisfy the same range.

### Deferred
- **DataLoader.** There are no relations, so there is no N+1 query to
  batch. Add it with the first relation (for example, postcards per
  sender).
- **An index on `(createdAt, id)`.** Not needed at this volume. Adding it
  needs a new Prisma migration (never an edit to an existing one).
- **Field-level authorization** (for example, hiding `message` from a
  read-only agent role). It needs real roles first, which ADR-0007 defers.
- **Persisted operations** (an allow-list of query hashes). The dashboard
  already sends one fixed query, so this is a small step if agents get
  their own credentials.
- **Pointing the MCP tool at GraphQL.** `list_pending_postcards` could POST
  the fixed query `postcards(status: SUBMITTED)` over HTTP, which keeps
  ADR-0011's "tools call routes over HTTP" rule and removes its in-memory
  filter. Left out of this change to keep the MCP surface untouched.

## Sources
- GraphQL Yoga, "Integration with Next.js" (route handler setup,
  `graphqlEndpoint`, `fetchAPI: { Response }`):
  https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-nextjs
- GraphQL Yoga, "Error masking" (`maskedErrors`, `"Unexpected error."`,
  `GraphQLError` passes through):
  https://the-guild.dev/graphql/yoga-server/docs/features/error-masking
- GraphQL Yoga, "Request batching" (off by default):
  https://the-guild.dev/graphql/yoga-server/docs/features/request-batching
- GraphQL Yoga, "CSRF prevention" (the plugin works by requiring a header
  that forces a preflight):
  https://the-guild.dev/graphql/yoga-server/docs/features/csrf-prevention
- Pothos, Relay plugin (connections, `nodeQueryOptions` /
  `nodesQueryOptions`): https://pothos-graphql.dev/docs/plugins/relay
- Pothos, Complexity plugin (depth/breadth/complexity limits, per-field
  `complexity` with a multiplier, calculated before any root field
  resolves):
  https://pothos-graphql.dev/docs/plugins/complexity
- GraphQL Cursor Connections Specification (Relay):
  https://relay.dev/graphql/connections.htm
- GraphQL.org, "Pagination" (cursor-based pagination):
  https://graphql.org/learn/pagination/
- Prisma, "Pagination" (cursor pagination needs a unique, sequential
  cursor field): https://www.prisma.io/docs/orm/prisma-client/queries/pagination
- Supabase, `pg_graphql` (schema reflected from tables; authorization via
  Postgres roles and row-level security): https://supabase.github.io/pg_graphql/
- tRPC, "Introduction" (types shared by importing the router type into a
  TypeScript client): https://trpc.io/docs
- Next.js, Route Handlers (read from the copy bundled with the installed
  Next.js 16.3.5 under `node_modules/next/dist/docs/`):
  https://nextjs.org/docs/app/api-reference/file-conventions/route
- The tRPC and Apollo rejection reasons and the specific limit values are
  judgment calls, not sourced recommendations, flagged per
  [ADR-0000](0000-record-architecture-decisions.md).
