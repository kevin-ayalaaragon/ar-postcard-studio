import { NextResponse } from "next/server";
import { storage, contentTypeFor } from "@/lib/storage";

// Streams a stored file back out. Indirecting through the storage
// abstraction (rather than a static /public mount) is what lets the
// storage driver swap to S3-compatible object storage in prod without
// this route or any client URL changing - see docs/adr/0005-file-storage.md.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  const data = await storage.getFile(key);
  if (!data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentTypeFor(key),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
