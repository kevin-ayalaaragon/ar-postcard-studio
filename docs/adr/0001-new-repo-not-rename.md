# 0001 - New repository instead of renaming ar-birthday-postcard

## Status
Accepted

## Context and Problem Statement
The task was originally framed as "rename this repo" to reflect the
broader product this is growing into. But `ar-birthday-postcard` is a
already-deployed, already-printed gift: its GitHub Pages URL
(`kevin-ayalaaragon.github.io/ar-birthday-postcard/`) is encoded in a QR
code on a physical postcard that has already been sent. The user
explicitly flagged, twice, that the existing gift must not break.

## Decision Drivers
- A renamed GitHub repository's Pages site is served from a URL derived
  from the new repo name; GitHub's repo-rename redirects cover the repo
  page itself but are not a guaranteed, verified-safe path for a live
  Pages deployment already baked into a printed, unchangeable QR code.
- The new product (public multi-user app with a backend/DB) needs a
  different hosting target entirely (a Node server, not static Pages), so
  nothing is gained by keeping it in the same repo/deploy pipeline.

## Considered Options
1. Rename `ar-birthday-postcard` in place.
2. Build the new app inside `ar-birthday-postcard` as a subdirectory,
   deployed separately, leaving the existing root files untouched.
3. Create a new, separate repository (`ar-postcard-studio`) and leave
   `ar-birthday-postcard` completely untouched.

## Decision Outcome
Option 3. Zero risk to the live gift, and a cleaner standalone portfolio
artifact for the new product (a dedicated full-stack repo, not a monorepo
mixing a personal one-off gift with a product). `ar-postcard-studio`'s
README links back to `ar-birthday-postcard` as the project it generalizes.

## Sources
This decision is a direct, low-risk response to explicit user instruction
in-session ("we dont want to break the postcard we have already built" /
"make sure we dont break the birthday gift we created") rather than a
technical trade-off requiring an external citation.
