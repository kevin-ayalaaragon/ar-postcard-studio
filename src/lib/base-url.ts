/**
 * Origin this app uses to build absolute URLs to itself: the MCP tools'
 * calls to its own HTTP routes and the viewer URL encoded in each print
 * file's QR code. Lives in its own module (not inside src/app/mcp/route.ts)
 * so the fallback order is unit-testable without importing the MCP handler.
 */
export function baseUrl(): string {
  // `||`, not `??`: PUBLIC_BASE_URL has shipped to Vercel as an empty
  // string before (set but blank), which `??` treats as present and
  // `fetch()` then rejects as an unparseable URL. Falling through on any
  // falsy value catches that case too, not just unset.
  //
  // No fixed PUBLIC_BASE_URL is correct for Preview - every branch/PR gets
  // its own deployment URL, so a static value would point a preview's MCP
  // tools at the wrong deployment (or at production). VERCEL_URL is Vercel's
  // own per-deployment URL, auto-injected with no dashboard config needed,
  // so it's used as the fallback instead of another static default.
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
