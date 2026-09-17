import sharp from "sharp";
import { generateQrPng } from "./qr";

// US postcard back layout at 300 DPI, landscape 6in x 4in - a conventional
// print-shop-ready size. The front print file is never regenerated here:
// it's served as the exact bytes the sender uploaded, because that's the
// same image the admin compiles into targets.mind out-of-band, and any
// re-encoding risks drifting the print photo from the tracked image.
const WIDTH = 1800;
const HEIGHT = 1200;
const QR_SIZE = 460;
const MARGIN = 70;
const DIVIDER_X = WIDTH * 0.52;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Naive character-count word wrap - good enough at a fixed font size/column width for an MVP template. */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface PostcardBackInput {
  message: string;
  senderName: string;
  recipientName: string;
  viewerUrl: string;
}

/**
 * Renders the postcard back (message, "POST CARD" masthead, address/stamp
 * box, and a scannable QR code pointing at the AR viewer) as a print-ready
 * PNG. Built as an SVG overlay rasterized by sharp/resvg rather than a
 * canvas library, keeping text crisp at print resolution - see
 * docs/adr/0004-print-file-generation.md.
 */
export async function renderPostcardBack(input: PostcardBackInput): Promise<Buffer> {
  const qrPng = await generateQrPng(input.viewerUrl, QR_SIZE);

  const messageLines = wrapText(input.message, 34);
  const lineHeight = 44;
  const messageStartY = 260;

  const messageTspans = messageLines
    .map((line, i) => `<tspan x="${MARGIN}" y="${messageStartY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fffdf7" />

  <text x="${MARGIN}" y="150" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="bold" fill="#1a1a1a" letter-spacing="6">POST CARD</text>
  <line x1="${MARGIN}" y1="190" x2="${DIVIDER_X - 40}" y2="190" stroke="#1a1a1a" stroke-width="3" />

  <text font-family="'Segoe UI', Arial, sans-serif" font-size="34" fill="#2b2b2b">${messageTspans}</text>

  <text x="${MARGIN}" y="${HEIGHT - 70}" font-family="'Segoe UI', Arial, sans-serif" font-size="30" font-style="italic" fill="#555555">- ${escapeXml(input.senderName)}</text>

  <line x1="${DIVIDER_X}" y1="${MARGIN}" x2="${DIVIDER_X}" y2="${HEIGHT - MARGIN}" stroke="#1a1a1a" stroke-width="3" />

  <text x="${DIVIDER_X + 50}" y="${MARGIN + 50}" font-family="'Segoe UI', Arial, sans-serif" font-size="28" fill="#555555">To:</text>
  <text x="${DIVIDER_X + 110}" y="${MARGIN + 50}" font-family="'Segoe UI', Arial, sans-serif" font-size="30" font-weight="600" fill="#1a1a1a">${escapeXml(input.recipientName)}</text>
  <line x1="${DIVIDER_X + 50}" y1="${MARGIN + 110}" x2="${WIDTH - MARGIN - 220}" y2="${MARGIN + 110}" stroke="#999999" stroke-width="2" />
  <line x1="${DIVIDER_X + 50}" y1="${MARGIN + 170}" x2="${WIDTH - MARGIN - 220}" y2="${MARGIN + 170}" stroke="#999999" stroke-width="2" />
  <line x1="${DIVIDER_X + 50}" y1="${MARGIN + 230}" x2="${WIDTH - MARGIN - 220}" y2="${MARGIN + 230}" stroke="#999999" stroke-width="2" />

  <rect x="${WIDTH - MARGIN - 190}" y="${MARGIN}" width="190" height="230" fill="none" stroke="#999999" stroke-width="2" stroke-dasharray="10 8" />
  <text x="${WIDTH - MARGIN - 95}" y="${MARGIN + 120}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="20" fill="#999999">PLACE</text>
  <text x="${WIDTH - MARGIN - 95}" y="${MARGIN + 146}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="20" fill="#999999">STAMP</text>
  <text x="${WIDTH - MARGIN - 95}" y="${MARGIN + 172}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="20" fill="#999999">HERE</text>

  <text x="${DIVIDER_X + (WIDTH - DIVIDER_X) / 2}" y="${HEIGHT - MARGIN - QR_SIZE - 20}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="26" font-weight="600" fill="#1a1a1a">Scan to watch it move</text>
</svg>`.trim();

  const qrX = Math.round(DIVIDER_X + (WIDTH - DIVIDER_X - QR_SIZE) / 2);
  const qrY = HEIGHT - MARGIN - QR_SIZE;

  return sharp(Buffer.from(svg))
    .composite([{ input: qrPng, left: qrX, top: qrY }])
    .png()
    .toBuffer();
}
