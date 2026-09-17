# 0007 - Shared-secret admin auth (deliberate MVP placeholder)

## Status
Accepted (temporary - see Consequences)

## Context and Problem Statement
Only the admin (currently: one person) attaches `.mind`/`.mp4` assets to
a submission. The task explicitly scopes automating that step as future
work, meaning a human admin flow has to exist now, but building a full
auth system (accounts, sessions, password hashing, recovery) for exactly
one admin user is disproportionate for an MVP.

## Decision Outcome
A single secret (`ADMIN_SECRET` env var) sent as an `x-admin-secret`
header, checked with a timing-safe comparison
(`src/lib/admin-auth.ts`). No accounts, no sessions, no password storage.
This is explicitly logged here as a placeholder: it must be replaced with
real session/OAuth-based auth before this app has more than one admin, or
before the admin surface is exposed somewhere less trusted than "the
person running the deploy set the env var."

### Consequences
- Positive: zero additional infrastructure; correct for a single-admin
  MVP.
- Negative: no audit trail of *which* admin acted, no revocation short of
  rotating the secret. Tracked as known debt, not an oversight.

## Sources
This is a scoping/judgment call for a single-admin MVP rather than a
technique requiring external citation - flagged here per the project's
"cite synthesis too" rule specifically so a reader doesn't mistake it for
a considered security posture.
