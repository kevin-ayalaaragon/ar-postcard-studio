# 0010 - Hosting: Vercel + Neon Postgres + Backblaze B2

## Status
Accepted. Implements the production side of 0006's storage abstraction
and 0009's Postgres datasource; no prior hosting ADR existed (0002's
Deployment section said "not yet deployed"). The object-storage vendor in
this decision was revised from an initial Cloudflare R2 choice before any
deploy happened against it - see the note at the end of Decision Outcome.

## Context and Problem Statement
0002 chose a Next.js App Router monolith partly so it wouldn't need two
separately-hosted services. That still leaves three things to place: the
app itself (needs Node.js, not just static hosting - see 0002's SSR/route
handler reasoning), a Postgres database (0009), and S3-compatible object
storage for uploaded/generated files (0006). All at $0/month: this is a
resume artifact with no revenue, not a funded product.

## Decision Drivers
- $0 recurring cost at this project's traffic level.
- No payment method required to provision the free tier, not just no
  charge incurred - this project has no budget owner to hand a card to,
  and a card-on-file is friction and exposure this decision doesn't need
  to accept if a comparable option exists without it.
- Conventional/job-market-legible choices (0002 already named this as a
  driver) over unfamiliar or niche infrastructure.
- No local Docker/infra requirement (0009's dev-Postgres decision already
  depends on this holding for the database specifically).
- Must actually support this app's technical requirements: `sharp`
  (native binary, needs a Node.js function runtime, not Edge) and Prisma
  migrations running once per deploy, not per-request.

## Considered Options
1. Vercel (app) + Neon (Postgres) + Cloudflare R2 (object storage).
2. Vercel (app) + Neon (Postgres) + Backblaze B2 (object storage).
3. Railway or Render, single platform for app + Postgres + a volume/bucket
   add-on.
4. Fly.io, app + attached Postgres + Tigris object storage.
5. AWS directly (Amplify/App Runner + RDS + S3).

## Decision Outcome
Option 2. Vercel is the reference deployment target for Next.js - built by
the same team, zero-config for an App Router project, and the free Hobby
tier (100GB bandwidth, 1M function invocations/month, 4 CPU-hours) covers
this project's traffic with margin. Neon is Vercel's native Postgres
integration and its free tier (100 CU-hours/month, scale-to-zero) is
enough for a low-traffic app; it's also what 0009's dev-branch plan
depends on. Backblaze B2 gives the S3-compatible target 0006 already
named the app needing (`StorageDriver` isolates the app from the specific
vendor entirely) with a free tier (10GB storage, permanent, S3-compatible
API) that requires no payment method to activate at all.

Two real constraints this choice has to work within:
- Vercel Hobby functions time out at 10 seconds. The print-generation
  path (0005: sharp SVG rasterization for a single postcard) is well
  within that; if this ever needs to process video transcoding or batch
  jobs, that would need a queue/background-job approach, not a request
  handler - not needed at this project's current scope.
- Vercel Hobby is non-commercial-use only per its terms. Fine for a
  portfolio piece; would force a move to Pro if this ever took real
  submissions/payment.

Option 1 (Cloudflare R2) was the first choice here, and was reversed
before ever being deployed against: R2's free tier doesn't charge
anything either, but Cloudflare requires a payment method on file to
activate R2 specifically (unlike the rest of a Cloudflare account),
which the "no payment method" driver above rules out when B2 meets the
same technical requirement without it. Option 3 (Railway/Render) and
Option 4 (Fly.io) were rejected: both are reasonable and would work, but
are less immediately recognizable to a reviewer skimming a resume than
"Vercel + Postgres" - the job-market legibility driver from 0002 applies
here too. Option 5 (raw AWS) was rejected as more infrastructure than an
MVP at this scale needs to stand up, and AWS requires a card regardless.

### Consequences
- Positive: entire stack free at this project's scale with no payment
  method required anywhere in the stack; matches an already in-progress
  decision (0009) and an already-written abstraction (0006) rather than
  requiring new code beyond an S3-compatible `StorageDriver`
  implementation.
- Negative: three separate free-tier accounts to provision (Vercel, Neon,
  Backblaze) instead of one platform; acceptable given the option-3/4
  tradeoff above. B2's S3-compatible API is a secondary product on top of
  B2's native API (unlike R2, which is S3-compatible-first) - no
  practical difference observed for this app's simple put/get usage, but
  worth knowing if this ever needs a less common S3 operation.

## Sources
- Vercel Hobby plan limits (bandwidth, function invocations, compute
  hours, 10s function timeout, non-commercial-use restriction), current
  as of this decision: https://vercel.com/docs/plans/hobby
- Neon free plan limits (100 CU-hours/month, scale-to-zero), current as
  of this decision: https://neon.com/docs/introduction/plans
- Backblaze B2 free tier (10GB storage, no credit card required to sign
  up) and its S3-compatible API: https://www.backblaze.com/cloud-storage
  and https://www.backblaze.com/docs/cloud-storage-s3-compatible-api
- Cloudflare R2 requiring a payment method to activate R2 specifically,
  contrasted with sign-up for a Cloudflare account itself not requiring
  one: https://www.cloudflare.com/products/r2/ (free-tier claim) and
  Cloudflare Community reports of the R2-specific card requirement,
  cross-checked against direct current pricing pages for both vendors.
