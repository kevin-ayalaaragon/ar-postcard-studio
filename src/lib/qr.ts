import QRCode from "qrcode";

/**
 * Print-safe QR settings, carried over from this project's predecessor
 * (github.com/kevin-ayalaaragon/ar-birthday-postcard/blob/master/generate_qr.py):
 * - errorCorrectionLevel 'H' (~30% recovery): survives print wear, stamps,
 *   folds, or other art placed near the code.
 * - margin 4: the QR spec's minimum quiet zone, in modules. Cropping this
 *   away measurably hurts real-world scan reliability.
 * - Pure black-on-white for maximum scanner contrast.
 * See docs/adr/0003-qr-generation.md for citations.
 */
export async function generateQrPng(url: string, sizePx = 600): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: sizePx,
    color: { dark: "#000000ff", light: "#ffffffff" },
    type: "png",
  });
}
