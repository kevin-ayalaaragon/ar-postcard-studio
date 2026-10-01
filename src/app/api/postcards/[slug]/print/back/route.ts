import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/db";
import { renderPostcardBack } from "@/lib/postcard-print";

// Generated on request rather than cached in storage: it's cheap (one SVG
// rasterize) and always reflects the current message/recipient if either
// is edited later.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const postcard = await prisma.postcard.findUnique({ where: { slug } });
  if (!postcard) {
    return NextResponse.json({ error: "Postcard not found" }, { status: 404 });
  }

  const viewerUrl = `${baseUrl()}/postcard/${slug}`;

  const png = await renderPostcardBack({
    message: postcard.message,
    senderName: postcard.senderName,
    recipientName: postcard.recipientName,
    viewerUrl,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${slug}-back.png"`,
    },
  });
}
