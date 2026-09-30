import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateQrPng } from "@/lib/qr";
import { renderPostcardBack } from "@/lib/postcard-print";
import { decodeQr } from "./helpers";

const VIEWER_URL = "https://ar-postcard-studio.vercel.app/postcard/p9hrfejrr6";

describe("generateQrPng", () => {
  it("round-trips: the generated PNG decodes back to the exact URL", async () => {
    const png = await generateQrPng(VIEWER_URL);
    expect(await decodeQr(png)).toBe(VIEWER_URL);
  });

  it("renders at the requested width as a PNG", async () => {
    const png = await generateQrPng(VIEWER_URL, 460);
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(460);
  });

  it("keeps a quiet zone: the outermost rows are pure white", async () => {
    const png = await generateQrPng(VIEWER_URL, 600);
    const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    const topRow = data.subarray(0, info.width);
    expect(Math.min(...topRow)).toBe(255);
  });

  it("still decodes at a long URL (higher QR version)", async () => {
    const long = `${VIEWER_URL}?ref=${"x".repeat(120)}`;
    expect(await decodeQr(await generateQrPng(long, 800))).toBe(long);
  });
});

describe("renderPostcardBack", () => {
  const input = {
    message: "Happy birthday! Wishing you a wonderful year ahead, full of good surprises.",
    senderName: "Kevin",
    recipientName: "Ana <&> \"Q\"",
    viewerUrl: VIEWER_URL,
  };

  it("produces a 1800x1200 PNG (6x4 in at 300 DPI)", async () => {
    const png = await renderPostcardBack(input);
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(1800);
    expect(meta.height).toBe(1200);
    expect(meta.width! / 300).toBe(6);
    expect(meta.height! / 300).toBe(4);
  });

  it("embeds a QR code that scans back to the viewer URL", async () => {
    const png = await renderPostcardBack(input);
    expect(await decodeQr(png)).toBe(VIEWER_URL);
  });

  it("escapes markup in names so it cannot break the SVG layout", async () => {
    await expect(renderPostcardBack(input)).resolves.toBeInstanceOf(Buffer);
  });

  it("handles a maximum-length 500-character message", async () => {
    const png = await renderPostcardBack({ ...input, message: "word ".repeat(100).trim() });
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height]).toEqual([1800, 1200]);
  });
});
