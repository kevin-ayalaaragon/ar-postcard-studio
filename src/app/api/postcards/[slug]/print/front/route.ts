import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage, contentTypeFor } from "@/lib/storage";

// The print-ready front is the sender's original photo, byte-for-byte -
// it's the same file the admin compiles into targets.mind, so re-encoding
// it here would risk the printed photo drifting from what MindAR tracks.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const postcard = await prisma.postcard.findUnique({ where: { slug } });
  if (!postcard) {
    return NextResponse.json({ error: "Postcard not found" }, { status: 404 });
  }

  const data = await storage.getFile(postcard.photoPath);
  if (!data) {
    return NextResponse.json({ error: "Photo file missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(postcard.photoPath),
      "Content-Disposition": `attachment; filename="${slug}-front.${postcard.photoPath.split(".").pop()}"`,
    },
  });
}
