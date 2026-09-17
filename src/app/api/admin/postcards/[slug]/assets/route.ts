import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import {
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_MIND_BYTES,
} from "@/lib/validation";

// Admin-only: attach the MindAR .mind target (compiled out-of-band from the
// same photo the sender uploaded, via https://hiukim.github.io/mind-ar-js-doc/tools/compile/)
// and the .mp4 animation. This is the manual step the task description
// calls out as staying manual for now - automating target/video generation
// from the photo is future work, not in this MVP.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAuthorizedAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const postcard = await prisma.postcard.findUnique({ where: { slug } });
  if (!postcard) {
    return NextResponse.json({ error: "Postcard not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const targetMind = formData.get("targetMind");
  const video = formData.get("video");

  if (!(targetMind instanceof File) || !(video instanceof File)) {
    return NextResponse.json(
      { error: "Both targetMind (.mind) and video (.mp4) files are required" },
      { status: 400 }
    );
  }
  if (!targetMind.name.endsWith(".mind")) {
    return NextResponse.json({ error: "targetMind must be a .mind file" }, { status: 400 });
  }
  if (targetMind.size > MAX_MIND_BYTES) {
    return NextResponse.json({ error: "targetMind file is too large (max 20MB)" }, { status: 400 });
  }
  if (!ACCEPTED_VIDEO_TYPES.includes(video.type)) {
    return NextResponse.json({ error: "video must be an MP4 (H.264/AAC)" }, { status: 400 });
  }
  if (video.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "video file is too large (max 100MB)" }, { status: 400 });
  }

  const targetMindPath = `postcards/${slug}/target.mind`;
  const videoPath = `postcards/${slug}/video.mp4`;

  await storage.putFile(targetMindPath, Buffer.from(await targetMind.arrayBuffer()));
  await storage.putFile(videoPath, Buffer.from(await video.arrayBuffer()));

  const updated = await prisma.postcard.update({
    where: { slug },
    data: { targetMindPath, videoPath, status: "READY" },
  });

  return NextResponse.json({ slug: updated.slug, status: updated.status });
}
