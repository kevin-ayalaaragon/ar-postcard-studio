import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { generateSlug } from "@/lib/slug";
import {
  submitPostcardSchema,
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
} from "@/lib/validation";

const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Public endpoint: anyone submits a photo + message to start a postcard.
// It only ever creates a SUBMITTED row - attaching the MindAR target/video
// is a separate, admin-only step (see /api/admin/postcards/[slug]/assets),
// matching the "assets are supplied out-of-band for now" MVP scope.
export async function POST(request: Request) {
  const formData = await request.formData();

  const fields = submitPostcardSchema.safeParse({
    senderName: formData.get("senderName"),
    recipientName: formData.get("recipientName"),
    message: formData.get("message"),
  });
  if (!fields.success) {
    return NextResponse.json(
      { error: fields.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "A photo is required" }, { status: 400 });
  }
  if (!ACCEPTED_PHOTO_TYPES.includes(photo.type)) {
    return NextResponse.json(
      { error: `Photo must be one of: ${ACCEPTED_PHOTO_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "Photo is too large (max 15MB)" }, { status: 400 });
  }

  const photoBuffer = Buffer.from(await photo.arrayBuffer());

  let metadata;
  try {
    metadata = await sharp(photoBuffer).metadata();
  } catch {
    return NextResponse.json({ error: "Could not read that image file" }, { status: 400 });
  }
  if (!metadata.width || !metadata.height) {
    return NextResponse.json({ error: "Could not read that image's dimensions" }, { status: 400 });
  }

  const slug = generateSlug();
  const ext = EXT_FOR_TYPE[photo.type] ?? "jpg";
  const photoPath = `postcards/${slug}/photo.${ext}`;
  await storage.putFile(photoPath, photoBuffer);

  const postcard = await prisma.postcard.create({
    data: {
      slug,
      senderName: fields.data.senderName,
      recipientName: fields.data.recipientName,
      message: fields.data.message,
      photoPath,
      photoWidthPx: metadata.width,
      photoHeightPx: metadata.height,
    },
  });

  return NextResponse.json(
    { slug: postcard.slug, status: postcard.status },
    { status: 201 }
  );
}
