import sharp from "sharp";
import jsQR from "jsqr";

/** A real, decodable PNG of the given size (solid colour). */
export async function makePng(width = 100, height = 150): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 60 } },
  })
    .png()
    .toBuffer();
}

/** Decode a QR code out of a PNG buffer; returns its text or null. */
export async function decodeQr(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return result ? result.data : null;
}

export function adminRequest(url: string, secret?: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (secret !== undefined) headers.set("x-admin-secret", secret);
  return new Request(url, { ...init, headers });
}
