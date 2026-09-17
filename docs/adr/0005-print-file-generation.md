# 0005 - sharp + SVG overlay for print-ready postcard files; front is never re-encoded

## Status
Accepted

## Context and Problem Statement
Two print-ready files are needed per postcard: a front (the sender's
photo) and a back (message, "POST CARD" masthead, address lines, stamp
box, QR code). The back needs dynamic text layout (variable-length
message, names); the front must stay pixel-identical to what an admin
later compiles into `targets.mind`, or the printed photo and the
AR-tracked image drift apart.

## Decision Drivers
- Server-side image compositing needs to be fast and dependency-light.
- Text layout on a raster image from Node has no first-class "draw
  wrapped text" primitive - needs either a canvas library with font
  metrics, or an SVG-to-raster approach.
- Never touch the uploaded photo's bytes once compiled into a `.mind` file.

## Decision Outcome
- **Front**: served byte-for-byte from storage, no re-encoding
  (`/api/postcards/[slug]/print/front`).
- **Back**: built as an SVG string (masthead, divider lines, wrapped
  message text, address/stamp placeholders) with the QR PNG composited
  in, rasterized via `sharp` (`src/lib/postcard-print.ts`). `sharp` is
  used over ImageMagick bindings or Jimp because it's built on `libvips`
  and is the standard high-performance choice for Node image work; SVG
  overlay is used over a canvas library because it keeps text crisp at
  print DPI without pulling in a native canvas dependency.
- Message wrapping is a naive character-count wrap at a fixed font
  size/column width - acceptable for an MVP template, flagged in code as
  a known simplification if the design needs to get fancier.

## Sources
- `sharp` official docs (Node.js image processing built on libvips):
  https://sharp.pixelplumbing.com/
- `sharp`'s own benchmark page, showing resizing performance well ahead
  of ImageMagick/GraphicsMagick and pure-JS alternatives like Jimp:
  https://sharp.pixelplumbing.com/performance/
