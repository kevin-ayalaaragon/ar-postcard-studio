import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";
import ArViewer from "./ArViewer";

export const dynamic = "force-dynamic";

export default async function PostcardViewerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const postcard = await prisma.postcard.findUnique({ where: { slug } });

  if (!postcard) notFound();

  if (postcard.status !== "READY" || !postcard.targetMindPath || !postcard.videoPath) {
    return (
      <main style={pendingStyles.main}>
        <div style={pendingStyles.card}>
          <h1 style={pendingStyles.heading}>This postcard is still being prepared</h1>
          <p style={pendingStyles.body}>
            The photo for {postcard.recipientName} came through, but the AR animation
            hasn&apos;t been attached yet. Check back soon.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ArViewer
      targetMindUrl={fileUrl(postcard.targetMindPath)}
      videoUrl={fileUrl(postcard.videoPath)}
      photoWidthPx={postcard.photoWidthPx}
      photoHeightPx={postcard.photoHeightPx}
    />
  );
}

const pendingStyles = {
  main: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0303",
    padding: "24px",
  },
  card: {
    maxWidth: 420,
    textAlign: "center" as const,
    color: "#fff",
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  heading: { fontSize: "1.3rem", margin: "0 0 12px" },
  body: { fontSize: "0.95rem", opacity: 0.8, lineHeight: 1.5, margin: 0 },
};
