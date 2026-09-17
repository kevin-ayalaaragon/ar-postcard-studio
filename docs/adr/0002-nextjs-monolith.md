# 0002 - Next.js App Router monolith (frontend + API in one deployable)

## Status
Accepted

## Context and Problem Statement
The MVP needs: a public submission form (photo + message upload), a
backend to store and validate submissions, a way to serve per-submission
dynamic AR viewer pages, and an admin flow to attach AR assets. Given this
is a single-developer MVP intended partly as a resume/portfolio piece, the
framework choice needs to balance "conventional/production-representative"
against "no infrastructure to stand up before writing a line of product
code."

## Decision Drivers
- Avoid standing up and deploying two separate services (frontend +
  backend) for an MVP with one developer.
- Prefer a framework/pattern that's common in the current job market so
  the skill signal is legible to reviewers.
- Needs real server-side execution (file uploads, image compositing, a
  database) - a purely static site (like the original project) can't do
  this.

## Considered Options
1. Next.js App Router, with Route Handlers as the API layer (one
   deployable).
2. A separate SPA (e.g. Vite + React) plus a separate Node/Express API.
3. A non-JS backend (e.g. FastAPI) behind a JS frontend.

## Decision Outcome
Option 1. Route Handlers (`app/**/route.ts`) use the standard Web
Request/Response API and sit in the same project as the pages, which
removes an entire deploy pipeline and CORS/auth-boundary concern for an
MVP this size. The `mind-ar-js` viewer (see 0007) doesn't need SSR
anyway, so this doesn't cost anything on the AR side.

### Consequences
- Positive: one `npm run build`, one deploy target, shared TypeScript
  types between form validation and API handlers.
- Negative: if this becomes a real multi-service product later, the API
  layer will need to be extracted - acceptable, documented tech debt for
  an MVP.

## Sources
- Next.js official docs on Route Handlers (the App Router's API layer):
  https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js official blog on building APIs directly in Next.js, and when
  that's appropriate vs. a separate backend:
  https://nextjs.org/blog/building-apis-with-nextjs
