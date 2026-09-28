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
bucket (e.g. Backblaze B2) can be dropped in behind the same interface
without changing any caller or public URL shape.

## Sources
- The Twelve-Factor App, "Backing services": treat storage as an attached
  resource, swappable without code changes, with dev/prod parity as a
  goal - the architectural justification for this abstraction:
  https://12factor.net/backing-services
- Backblaze's official docs on B2's S3-compatible API, supporting the
  specific "swap to S3-compatible storage" production path named above
  (see [0010](0010-hosting-vercel-neon-b2.md) for the vendor choice):
  https://www.backblaze.com/docs/cloud-storage-s3-compatible-api
