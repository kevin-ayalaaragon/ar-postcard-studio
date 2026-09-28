# Architecture Decision Ledger

MADR-format decision records (https://adr.github.io/madr/), one file per
decision, kept up to date as the project evolves. Every entry cites a
source - an official doc, a standard, or an explicit note that the
decision was synthesized/judgment-call rather than sourced.

| # | Decision |
|---|---|
| [0000](0000-record-architecture-decisions.md) | Record architecture decisions with MADR |
| [0001](0001-new-repo-not-rename.md) | New repository instead of renaming ar-birthday-postcard |
| [0002](0002-nextjs-monolith.md) | Next.js App Router monolith (frontend + API in one deployable) |
| [0003](0003-database-orm.md) | Prisma ORM, SQLite dev / Postgres prod, pinned to the 6.x line |
| [0004](0004-qr-generation.md) | QR settings: error correction 'H', 4-module quiet zone, black-on-white |
| [0005](0005-print-file-generation.md) | sharp + SVG overlay for print-ready postcard files |
| [0006](0006-file-storage.md) | Storage abstraction: local dev, swappable to S3-compatible prod |
| [0007](0007-admin-auth.md) | Shared-secret admin auth (deliberate MVP placeholder) |
| [0008](0008-ar-viewer-reuse.md) | Keep MindAR.js + A-Frame; mount imperatively, not as React-managed JSX |
| [0009](0009-single-postgres-datasource.md) | Single Postgres datasource everywhere (drops 0003's SQLite-dev split) |
| [0010](0010-hosting-vercel-neon-r2.md) | Hosting: Vercel + Neon Postgres + Cloudflare R2 |
