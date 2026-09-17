# 0004 - QR settings: error correction 'H', 4-module quiet zone, black-on-white

## Status
Accepted

## Context and Problem Statement
The postcard back's QR code is the only path from a physical, printed
object back to the AR viewer. It has to keep scanning reliably after
printing, handling, and potentially a real postage stamp obscuring part
of the card near it.

## Decision Outcome
Carried forward unchanged from the predecessor project's
`generate_qr.py` (see its inline comments), reimplemented with the `qrcode`
npm package in `src/lib/qr.ts`:
- `errorCorrectionLevel: 'H'` (~30% codeword recovery) - the highest of
  the four standard levels, appropriate for a printed card that may be
  handled, folded, or have other art/a stamp near the code.
- `margin: 4` - the format's minimum quiet zone in modules; the npm
  package exposes this directly as `margin`.
- Pure black-on-white for maximum scanner contrast.

## Sources
- Denso Wave (the QR code's creator), official page on error correction
  levels and their recovery capacities/use cases:
  https://www.qrcode.com/en/about/error_correction.html
- `qrcode` npm package README, documenting `errorCorrectionLevel` and
  `margin`: https://github.com/soldair/node-qrcode/blob/master/README.md
- ISO/IEC 18004:2024 (QR code symbology standard) catalog listing - full
  text is paywalled, cited here as the underlying standard the above
  secondary sources describe: https://www.iso.org/standard/83389.html
