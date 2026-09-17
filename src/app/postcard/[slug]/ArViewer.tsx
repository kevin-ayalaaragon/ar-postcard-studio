"use client";

import { useEffect, useRef } from "react";
import "./ar-viewer.css";

// Ported from the predecessor project's index.html
// (github.com/kevin-ayalaaragon/ar-birthday-postcard), generalized to take
// per-postcard asset URLs and target dimensions as props instead of
// hardcoded globals. See docs/adr/0007-ar-viewer-reuse.md for why this
// stays vanilla-DOM/imperative rather than React-managed markup:
// A-Frame's custom elements mutate their own subtree (injecting a canvas,
// cursor, etc.), which fights React's reconciliation if React also owns
// that subtree. Mounting the scene via a plain container + innerHTML, the
// same way the original static page worked, sidesteps that entirely.

const AFRAME_SRC = "https://aframe.io/releases/1.5.0/aframe.min.js";
const MINDAR_SRC = "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}

export interface ArViewerProps {
  targetMindUrl: string;
  videoUrl: string;
  photoWidthPx: number;
  photoHeightPx: number;
}

export default function ArViewer({
  targetMindUrl,
  videoUrl,
  photoWidthPx,
  photoHeightPx,
}: ArViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    async function mount() {
      await loadScriptOnce(AFRAME_SRC);
      await loadScriptOnce(MINDAR_SRC);
      if (cancelled || !container) return;

      container.innerHTML = `
        <div id="start-overlay">
          <h1>A message for you</h1>
          <p>Point your camera at the postcard and tap start to bring the picture to life.</p>
          <button id="start-btn">Tap to Start</button>
        </div>

        <div id="error-overlay">
          <h2 id="error-title">Camera access is needed</h2>
          <p id="error-message"></p>
          <button id="error-retry-btn">Try Again</button>
        </div>

        <div id="confetti-container"></div>

        <a-scene
          id="ar-scene"
          mindar-image="imageTargetSrc: ${targetMindUrl}; autoStart: false; uiScanning: no; uiLoading: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001;"
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights: true"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          embedded
        >
          <a-assets>
            <video
              id="ar-video"
              src="${videoUrl}"
              preload="auto"
              loop="true"
              playsinline
              webkit-playsinline
              crossorigin="anonymous"
            ></video>
          </a-assets>

          <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false" raycaster="near: 10; far: 10000;"></a-camera>

          <a-entity mindar-image-target="targetIndex: 0" id="target-anchor">
            <a-video
              id="ar-video-plane"
              src="#ar-video"
              width="1"
              height="1"
              position="0 0 0"
              rotation="0 0 0"
            ></a-video>
          </a-entity>
        </a-scene>
      `;

      wireUpScene(container, photoWidthPx, photoHeightPx);
    }

    mount().catch((err) => {
      console.error("Failed to mount AR scene", err);
    });

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [targetMindUrl, videoUrl, photoWidthPx, photoHeightPx]);

  return <div ref={containerRef} className="ar-viewer-root" />;
}

function wireUpScene(root: HTMLElement, targetW: number, targetH: number) {
  const startOverlay = root.querySelector<HTMLElement>("#start-overlay")!;
  const startBtn = root.querySelector<HTMLButtonElement>("#start-btn")!;
  const errorOverlay = root.querySelector<HTMLElement>("#error-overlay")!;
  const errorTitle = root.querySelector<HTMLElement>("#error-title")!;
  const errorMessage = root.querySelector<HTMLElement>("#error-message")!;
  const errorRetryBtn = root.querySelector<HTMLButtonElement>("#error-retry-btn")!;
  const sceneEl = root.querySelector<HTMLElement & { systems: Record<string, { start: () => Promise<void> }> }>("#ar-scene")!;
  const videoEl = root.querySelector<HTMLVideoElement>("#ar-video")!;
  const videoPlane = root.querySelector<HTMLElement>("#ar-video-plane")!;
  const anchor = root.querySelector<HTMLElement>("#target-anchor")!;

  let lastCameraError: DOMException | null = null;
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (constraints) {
      return originalGetUserMedia(constraints).catch((err) => {
        lastCameraError = err;
        throw err;
      });
    };
  }

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  function describeCameraError(err: DOMException | null) {
    const name = err?.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        title: "Camera permission is blocked",
        message: isIOS
          ? "Go to Settings → Safari → Camera, and allow access for this site (or Settings → Safari → Advanced → Website Data, remove this site, then reload)."
          : "Tap the lock icon next to the address bar → Permissions → Camera, and switch it to Allow.",
      };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { title: "No camera found", message: "This device doesn't have a usable camera, or it isn't accessible right now." };
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return { title: "Camera is busy", message: "Another app may be using the camera. Close other camera apps and try again." };
    }
    return {
      title: "Camera access is needed",
      message: "Please allow camera permission for this site in your browser settings, then try again.",
    };
  }

  function showCameraError() {
    const { title, message } = describeCameraError(lastCameraError);
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorOverlay.classList.add("visible");
  }

  const CONFETTI_COLORS = ["#ff8a3d", "#ffcf4d", "#ff5f6d", "#6de3c0", "#8ab4ff"];
  const confettiContainer = root.querySelector<HTMLElement>("#confetti-container")!;

  function launchConfetti() {
    const frag = document.createDocumentFragment();
    const pieceCount = 60;
    let maxLifetime = 0;

    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      const duration = 1.6 + Math.random() * 1.2;
      const delay = Math.random() * 0.35;
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      piece.style.animationDuration = duration + "s";
      piece.style.animationDelay = delay + "s";
      maxLifetime = Math.max(maxLifetime, duration + delay);
      frag.appendChild(piece);
    }

    confettiContainer.appendChild(frag);
    setTimeout(() => {
      confettiContainer.innerHTML = "";
    }, maxLifetime * 1000 + 200);
  }

  videoPlane.setAttribute("width", "1");
  videoPlane.setAttribute("height", String(targetH / targetW));

  let started = false;
  let audioUnlocked = false;

  function unlockAudioThenStop() {
    if (audioUnlocked) return;
    videoEl.muted = false;
    videoEl
      .play()
      .then(() => {
        videoEl.pause();
        videoEl.currentTime = 0;
        audioUnlocked = true;
      })
      .catch(() => {
        videoEl.muted = true;
        videoEl
          .play()
          .then(() => {
            videoEl.pause();
            videoEl.currentTime = 0;
            audioUnlocked = true;
          })
          .catch(() => {});
      });
  }

  async function start() {
    if (started) return;
    started = true;

    unlockAudioThenStop();

    startOverlay.classList.add("hidden");
    errorOverlay.classList.remove("visible");

    try {
      const arSystem = sceneEl.systems["mindar-image-system"];
      await arSystem.start();
    } catch (err) {
      console.error("MindAR failed to start", err);
      started = false;
      showCameraError();
    }
  }

  startBtn.addEventListener("click", () => {
    launchConfetti();
    start();
  });

  errorRetryBtn.addEventListener("click", () => {
    started = false;
    start();
  });

  anchor.addEventListener("targetFound", () => {
    videoEl.currentTime = 0;
    videoEl.play().catch((err) => console.warn("play() blocked", err));
  });

  anchor.addEventListener("targetLost", () => {
    videoEl.pause();
  });

  sceneEl.addEventListener("arError", (e) => {
    console.error("AR error", (e as CustomEvent).detail, lastCameraError);
    started = false;
    showCameraError();
  });
}
