import { timingSafeEqual } from "node:crypto";

/**
 * MVP stand-in for real auth: a single shared secret sent as a header,
 * checked with a timing-safe comparison. Documented as a deliberate
 * placeholder in docs/adr/0007-admin-auth.md - swap for real
 * session/OAuth-based auth before this app has more than one admin.
 */
export function isAuthorizedAdmin(request: Request): boolean {
  const provided = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.ADMIN_SECRET ?? "";
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
