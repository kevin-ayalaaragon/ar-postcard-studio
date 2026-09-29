# 0011 - Expose admin operations as an MCP server, embedded in the Next.js app

## Status
Accepted

## Context and Problem Statement
The admin workflow (list submissions waiting on AR assets, attach a compiled
`.mind`/`.mp4`, pull print files) currently only has a human UI at `/admin`
and raw HTTP routes. Exposing the same operations to an MCP client (Claude
Desktop, Claude Code, or any other MCP-speaking agent) needed a decision on
where that server lives: its own repo, a monorepo package, or inside this
app.

## Decision Drivers
- This app is one admin's workflow for one product, not a reusable library
  meant for other projects to depend on - no case for independent
  versioning or publishing.
- [ADR-0002](0002-nextjs-monolith.md) already chose one deployable for pages
  + API routes over splitting services; a separate MCP service would reverse
  that reasoning for no functional gain.
- Vercel's own Next.js MCP guidance places a custom MCP server inside the
  existing App Router project via a route handler, not as a standalone
  service.

## Considered Options
1. Separate repository for the MCP server.
2. A monorepo package (`packages/mcp` or similar) alongside the app.
3. Embed the MCP server as a Next.js route handler inside this app,
   calling the existing admin/public API routes over HTTP instead of
   duplicating their Prisma/storage logic.

## Decision Outcome
Option 3 (`src/app/mcp/route.ts`, using `mcp-handler` + `@modelcontextprotocol/server`).
The monorepo and multi-repo patterns exist to manage *multiple* related
servers or shared libraries across them - neither applies to a single app
exposing a handful of its own operations. Tools call the already-existing
`/api/admin/postcards`, `/api/admin/postcards/[slug]/assets`, and
`/api/postcards/[slug]` routes rather than reimplementing their logic, so
those routes stay the single source of truth and the MCP layer stays thin.

### Consequences
- Positive: zero new infrastructure or deployment target; reuses the $0/month
  hosting from [ADR-0010](0010-hosting-vercel-neon-b2.md).
- Negative: tools that mutate data (`attach_ar_assets`) inherit
  [ADR-0007](0007-admin-auth.md)'s shared-secret placeholder auth rather than
  something MCP-specific - accepted as the same already-documented debt, not
  new debt introduced here.

## Sources
- Next.js MCP guide (confirms Next.js's own MCP feature, `next-devtools-mcp`,
  is a dev-diagnostics tool for coding agents, not for exposing app
  business logic - this ADR's use case needed the separate `mcp-handler`
  package instead): https://nextjs.org/docs/app/guides/mcp
- `mcp-handler` + example Next.js MCP server (route handler pattern, package
  name, and `registerTool` API verified directly against the repo's
  `app/mcp/route.ts` and `package.json`, not a summary of them):
  https://github.com/vercel-labs/mcp-for-next.js
- Model Context Protocol specification: https://modelcontextprotocol.io
