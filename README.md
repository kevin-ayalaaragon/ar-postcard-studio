# AR Postcard Studio

Full-stack successor to
[ar-birthday-postcard](https://github.com/kevin-ayalaaragon/ar-birthday-postcard)
(a one-off, hardcoded WebAR birthday card). This app generalizes that idea
into a real submission pipeline: someone uploads a photo and writes a
message, and the app produces a print-ready postcard (front + back with a
QR code) paired with a per-postcard AR viewer page.

`ar-birthday-postcard` is **not touched by this project** - it's a printed,
already-delivered gift and stays exactly as it is. See
[docs/adr/0001-new-repo-not-rename.md](docs/adr/0001-new-repo-not-rename.md)
for why this lives in its own repo instead of renaming/rewriting that one.

## What this MVP does - and deliberately doesn't - automate

1. A sender submits a photo + a message + names (`/`).
2. That creates a `SUBMITTED` postcard record and stores the photo.
3. **An admin compiles the AR assets out-of-band** - the same manual step
   as the predecessor project: run the sender's photo through MindAR's
   compiler (https://hiukim.github.io/mind-ar-js-doc/tools/compile/) to
   get a `.mind` target file, and prepare the matching `.mp4` overlay -
   then uploads both via `/admin`, which flips the record to `READY`.
4. The postcard is now live at `/postcard/[slug]`: a WebAR page that
   tracks the printed photo and plays the video on top of it, generalized
   from the predecessor's `index.html`.
5. The admin downloads print-ready front/back files
   (`/api/postcards/[slug]/print/front` and `.../print/back`) to send to a
   print shop.

**Automating step 3** (generating the `.mind`/`.mp4` from the photo
automatically) is explicit future work, not part of this MVP.

## Stack

Next.js (App Router, TypeScript) monolith, Prisma + SQLite (dev) /
Postgres (prod), `sharp` for print-file compositing, `qrcode` for the
scan code, MindAR.js + A-Frame for the AR viewer (carried over from the
predecessor project). Every non-obvious choice is recorded in
[docs/adr/](docs/adr/README.md) with a cited source.

Resume-relevant skills this build demonstrates are tracked in
[docs/differentiators.yaml](docs/differentiators.yaml).

## Local development

```bash
npm install
cp .env.example .env   # then set a real ADMIN_SECRET
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000` for the submission form, `http://localhost:3000/admin`
for the admin dashboard (enter the `ADMIN_SECRET` from `.env`).

Uploaded/generated files land under `./storage/` (gitignored, local-only -
see [docs/adr/0006-file-storage.md](docs/adr/0006-file-storage.md) for the
production swap to S3-compatible object storage).

## Deploy

Not yet deployed. Needs, at minimum: a Postgres database
(`DATABASE_URL`), S3-compatible object storage in place of the local
storage driver, and a real `ADMIN_SECRET`. A Node-capable host (Vercel,
Fly.io, Render, etc.) - this is a standard Next.js app, no exotic runtime
requirements.

## Future work

- Auto-generate the `.mind` target and animation from the uploaded photo
  instead of the manual admin step (the explicitly-deferred part of this
  task).
- Replace the shared-secret admin auth with real session/OAuth-based auth
  once there's more than one admin (docs/adr/0007-admin-auth.md).
- Swap local file storage for S3-compatible object storage in production
  (docs/adr/0006-file-storage.md).
