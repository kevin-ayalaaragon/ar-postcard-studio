# 0006 - Storage abstraction: local filesystem in dev, swappable to S3-compatible object storage in prod

## Status
Accepted

## Context and Problem Statement
Each postcard has 2-4 uploaded/generated files (photo, `.mind` target,
`.mp4`, generated back print). These need to be readable by any request,
survive restarts, and eventually live somewhere durable and CDN-fronted
in production - but an MVP shouldn't require provisioning cloud object
storage just to run locally.

## Decision Outcome
A single `StorageDriver` interface (`putFile`/`getFile`) in
`src/lib/storage.ts`, with one implementation today: a local-filesystem
driver rooted at `LOCAL_STORAGE_DIR`. All routes go through this
interface and a `/api/files/[...key]` route, rather than a static
`/public` mount - so a production driver backed by an S3-compatible
bucket (e.g. Cloudflare R2) can be dropped in behind the same interface
without changing any caller or public URL shape.

## Sources
- The Twelve-Factor App, "Backing services": treat storage as an attached
  resource, swappable without code changes, with dev/prod parity as a
  goal - the architectural justification for this abstraction:
  https://12factor.net/backing-services
- Cloudflare's official docs on R2 as S3-API-compatible object storage,
  supporting the specific "swap to S3-compatible storage" production
  path named above: https://www.cloudflare.com/developer-platform/use-cases/s3-compatible-object-storage/
