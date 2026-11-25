import { NextResponse } from "next/server";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { listAllPostcards, toAdminPostcard } from "@/lib/postcards";

// Admin-only list of every postcard, used by the /admin dashboard to show
// which submissions are still waiting on a target.mind + video upload.
//
// Deliberately unpaginated and shape-frozen: the MCP tool
// list_pending_postcards (src/app/mcp/route.ts) fetches this route and
// filters the FULL array for SUBMITTED in memory. Paginating here would make
// that tool silently drop rows. Paginated reads go through /api/graphql
// (docs/adr/0013-graphql-admin-api.md). Pinned by tests/api-routes.test.ts.
export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postcards = await listAllPostcards();

  return NextResponse.json(
    postcards.map(toAdminPostcard).map((p) => ({
      slug: p.slug,
      status: p.status,
      senderName: p.senderName,
      recipientName: p.recipientName,
      message: p.message,
      photoUrl: p.photoUrl,
      createdAt: p.createdAt,
    }))
  );
}
