# 0010 - Hosting: Vercel + Neon Postgres + Cloudflare R2

## Status
Accepted. Implements the production side of 0006's storage abstraction
and 0009's Postgres datasource; no prior hosting ADR existed (0002's
Deployment section said "not yet deployed").

## Context and Problem Statement
0002 chose a Next.js App Router monolith partly so it wouldn't need two
separately-hosted services. That still leaves three things to place: the
app itself (needs Node.js, not just static hosting - see 0002's SSR/route
handler reasoning), a Postgres database (0009), and S3-compatible object
storage for uploaded/generated files (0006). All at $0/month: this is a
resume artifact with no revenue, not a funded product.

## Decision Drivers
- $0 recurring cost at this project's traffic level.
- Conventional/job-market-legible choices (0002 already named this as a
  driver) over unfamiliar or niche infrastructure.
- No local Docker/infra requirement (0009's dev-Postgres decision already
  depends on this holding for the database specifically).
- Must actually support this app's technical requirements: `sharp`
  (native binary, needs a Node.js function runtime, not Edge) and Prisma
  migrations running once per deploy, not per-request.

## Considered Options
1. Vercel (app) + Neon (Postgres) + Cloudflare R2 (object storage).
2. Railway or Render, single platform for app + Postgres + a volume/bucket
   add-on.
3. Fly.io, app + attached Postgres + Tigris object storage.
4. AWS directly (Amplify/App Runner + RDS + S3).

## Decision Outcome
Option 1. Vercel is the reference deployment target for Next.js - built by
the same team, zero-config for an App Router project, and the free Hobby
tier (100GB bandwidth, 1M function invocations/month, 4 CPU-hours) covers
this project's traffic with margin. Neon is Vercel's native Postgres
integration and its free tier (100 CU-hours/month, scale-to-zero) is
enough for a low-traffic app; it's also what 0009's dev-branch plan
depends on. Cloudflare R2 is what 0006 already named as the example
S3-compatible target, has a free tier that doesn't expire (10GB storage,
zero egress fees - unlike S3's), and needs no new abstraction since
`StorageDriver` (0006) already isolates the app from the storage
implementation.

Two real constraints this choice has to work within:
- Vercel Hobby functions time out at 10 seconds. The print-generation
  path (0005: sharp SVG rasterization for a single postcard) is well
  within that; if this ever needs to process video transcoding or batch
  jobs, that would need a queue/background-job approach, not a request
  handler - not needed at this project's current scope.
- Vercel Hobby is non-commercial-use only per its terms. Fine for a
  portfolio piece; would force a move to Pro if this ever took real
  submissions/payment.

Option 2 (Railway/Render) and Option 3 (Fly.io) were rejected: both are
reasonable and would work, but are less immediately recognizable to a
reviewer skimming a resume than "Vercel + Postgres" - the job-market
legibility driver from 0002 applies here too. Option 4 (raw AWS) was
rejected as more infrastructure than an MVP at this scale needs to stand
up and pay for.

### Consequences
- Positive: entire stack free at this project's scale, matches an already
  in-progress decision (0009) and an already-written abstraction (0006)
  rather than requiring new code beyond an R2-backed `StorageDriver`
  implementation.
- Negative: three separate free-tier accounts to provision (Vercel, Neon,
  Cloudflare) instead of one platform; acceptable given the option-2/3
  tradeoff above.

## Sources
- Vercel Hobby plan limits (bandwidth, function invocations, compute
  hours, 10s function timeout, non-commercial-use restriction), current
  as of this decision: https://vercel.com/docs/plans/hobby
- Neon free plan limits (100 CU-hours/month, scale-to-zero), current as
  of this decision: https://neon.com/docs/introduction/plans
- Cloudflare R2 pricing - free tier (10GB storage/month, zero egress
  fees, no expiration): https://www.cloudflare.com/products/r2/
- 0006 (this repo) already naming Cloudflare R2 as the intended
  S3-compatible production target.
