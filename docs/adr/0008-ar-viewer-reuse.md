# 0008 - Keep MindAR.js + A-Frame; mount imperatively, not as React-managed JSX

## Status
Accepted

## Context and Problem Statement
The predecessor project (`ar-birthday-postcard`) already solved zero-install
WebAR image tracking with MindAR.js + A-Frame, including real fixes for
iOS audio unlock, camera-permission error messages, and confetti-on-tap.
The new app needs the same viewer, but data-driven per postcard
(`targetMindUrl`/`videoUrl`/dimensions from the DB) instead of hardcoded
globals, and embedded inside a Next.js/React app instead of a standalone
HTML file.

## Decision Drivers
- Don't rewrite AR tracking logic that's already been debugged on real
  devices - only generalize its configuration.
- A-Frame registers custom elements that manage their own DOM subtree
  (injecting a canvas, a cursor entity, etc.). Handing that subtree to
  React's reconciler risks React and A-Frame fighting over the same DOM
  nodes (React expects to own everything it renders; A-Frame mutates
  around it).

## Considered Options
1. Replace MindAR/A-Frame with a commercial SLAM-based SDK (e.g. 8th Wall).
2. Render the A-Frame scene as ordinary JSX inside the React tree.
3. Keep MindAR/A-Frame, but mount the scene imperatively into a plain
   container `<div>` via `innerHTML` + `useEffect`, the same way the
   original static page worked - React only ever owns the container, never
   the AR subtree.

## Decision Outcome
Option 3 (`src/app/postcard/[slug]/ArViewer.tsx`). Verified working
end-to-end in this session's dev server: scripts load, the tap-to-start
overlay and confetti render, and the camera-permission error path
(ported from the original's `describeCameraError`) fires correctly when
camera access is denied.

## Sources
- MindAR official repository (open-source, TensorFlow.js-based image
  tracking, A-Frame as its primary integration):
  https://github.com/hiukim/mind-ar-js
- MindAR official docs: https://hiukim.github.io/mind-ar-js-doc/
- Comparison of free/open marker-based web tracking (AR.js/MindAR's
  category) against 8th Wall's paid SLAM-based tracking, supporting
  "MindAR is the credible free/open choice for print-image tracking, not
  general world tracking": https://aircada.com/blog/8th-wall-vs-ar-js
- The React-vs-custom-elements DOM-ownership conflict is this session's
  own reasoning (not independently sourced) about why option 2 was
  rejected - flagged here as synthesis rather than an external citation.
