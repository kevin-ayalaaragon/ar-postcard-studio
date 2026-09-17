import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { fileUrl } from "@/lib/storage";

// Admin-only list of every postcard, used by the /admin dashboard to show
// which submissions are still waiting on a target.mind + video upload.
export async function GET(request: Request) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postcards = await prisma.postcard.findMany({ orderBy: { createdAt: "desc" } });

  return NextResponse.json(
    postcards.map((p) => ({
      slug: p.slug,
      status: p.status,
      senderName: p.senderName,
      recipientName: p.recipientName,
      message: p.message,
      photoUrl: fileUrl(p.photoPath),
      createdAt: p.createdAt,
    }))
  );
}
