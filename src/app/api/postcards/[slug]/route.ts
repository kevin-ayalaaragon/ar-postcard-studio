import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";

// Public status/metadata lookup - used by the confirmation page to poll
// whether an admin has attached AR assets yet, and by the viewer page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const postcard = await prisma.postcard.findUnique({ where: { slug } });
  if (!postcard) {
    return NextResponse.json({ error: "Postcard not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: postcard.slug,
    status: postcard.status,
    recipientName: postcard.recipientName,
    photoUrl: fileUrl(postcard.photoPath),
    photoWidthPx: postcard.photoWidthPx,
    photoHeightPx: postcard.photoHeightPx,
    targetMindUrl: postcard.targetMindPath ? fileUrl(postcard.targetMindPath) : null,
    videoUrl: postcard.videoPath ? fileUrl(postcard.videoPath) : null,
  });
}
