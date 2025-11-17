import React, { useCallback, useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import {
  CropIcon,
  AspectRatioIcon,
  FlipHorizontalIcon,
  RotateIcon,
  CompressIcon,
  EnhanceIcon,
  SaveIcon,
  ShareIcon,
  BackIcon,
  ImproveQualityIcon,
  UndoIcon,
  SunIcon,
  MoonIcon,
  ImagePlusIcon,
  RemoveBgIcon,
} from "./icons";
import { useTheme } from "../hooks/useTheme";
import { removeBackground } from "../utils/removeBackground";
import CropTool from "./CropTool";

interface EditorScreenProps {
  imageUri: string;
  onBack: () => void;
  onSave: (imageUri: string) => void;
}
type P = PointerEvent & {
  clientX: number;
  clientY: number;
};

type Tool =
  | "crop"
  | "ratio"
  | "flip"
  | "compress"
  | "enhance"
  | "import"
  | "removeBg"
  | null;

export default function EditorScreen({ imageUri, onBack, onSave }: EditorScreenProps) {
  const { theme, toggleTheme } = useTheme();
  // UI state
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing...");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [currentImageUri, setCurrentImageUri] = useState(imageUri);

  // Enhancement sliders (live preview)
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  // Compression
  const [compressionQuality, setCompressionQuality] = useState(92);

  // Overlay imported image
  const [overlay, setOverlay] = useState<{
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
  } | null>(null);

  // Refs for DOM
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafTickRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);

  // ---------- TRANSFORM / ZOOM / PAN logic (smooth, rAF-batched + inertia) ----------
  type TransformState = {
    tx: number; // translate x (px)
    ty: number; // translate y (px)
    scale: number;
  };

  // Current visible transform (applied to DOM)
  const transformRef = useRef<TransformState>({ tx: 0, ty: 0, scale: 1 });
  // Target transform we animate towards
  const targetRef = useRef<TransformState>({ tx: 0, ty: 0, scale: 1 });
  // Velocity for inertial fling
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  // Pointer tracking
  const pointers = useRef<Map<number, P>>(new Map());
  // Last pointer time/pos for velocity
  const lastPointerRef = useRef<{ t: number; x: number; y: number } | null>(null);

  // Force small re-render when animation running (only to update inline style that depends on transformRef)
  const [, setTick] = useState(0);
  const forceTick = () => setTick((n) => n + 1);

  const applyTransformToNode = () => {
    const el = imgRef.current;
    if (!el) return;
    const { tx, ty, scale } = transformRef.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  // Smooth animation loop
  const startLoop = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    const loop = () => {
      // spring / lerp toward target
      const cur = transformRef.current;
      const tgt = targetRef.current;
      // simple easing
      const ease = 0.15;
      cur.tx += (tgt.tx - cur.tx) * ease;
      cur.ty += (tgt.ty - cur.ty) * ease;
      cur.scale += (tgt.scale - cur.scale) * ease;

      // apply velocity for fling
      if (Math.abs(velocityRef.current.vx) > 0.02 || Math.abs(velocityRef.current.vy) > 0.02) {
        cur.tx += velocityRef.current.vx;
        cur.ty += velocityRef.current.vy;
        // friction
        velocityRef.current.vx *= 0.92;
        velocityRef.current.vy *= 0.92;
      }

      applyTransformToNode();
      forceTick();

      // stop cond
      const closeEnough =
        Math.abs(tgt.tx - cur.tx) < 0.3 && Math.abs(tgt.ty - cur.ty) < 0.3 && Math.abs(tgt.scale - cur.scale) < 0.001 && Math.abs(velocityRef.current.vx) < 0.05 && Math.abs(velocityRef.current.vy) < 0.05;

      if (!closeEnough) {
        rafTickRef.current = requestAnimationFrame(loop);
      } else {
        // finalize values
        transformRef.current = { ...tgt };
        applyTransformToNode();
        isAnimatingRef.current = false;
        velocityRef.current = { vx: 0, vy: 0 };
      }
    };
    rafTickRef.current = requestAnimationFrame(loop);
  };

  // Helpers for pinch calculations
  const getDistanceBetween = (a: PointerEvent, b: PointerEvent) => {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  };
  const getMidpoint = (a: PointerEvent, b: PointerEvent) => {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  };

  // On pointer down: track pointer, capture
  const onPointerDown = (e: React.P) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, e as unknown as PointerEvent);

    // cancel any fling velocity
    velocityRef.current = { vx: 0, vy: 0 };
    lastPointerRef.current = { t: performance.now(), x: e.clientX, y: e.clientY };

    // start loop
    startLoop();
  };

  const onPointerMove = (e: React.P) => {
    // update pointer map
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, e as unknown as PointerEvent);

    const pts: P[] = Array.from(pointers.current.values());

    // single pointer -> pan
    if (pts.length === 1) {
      const p = pts[0];
      // compute delta from last pointer for velocity
      if (lastPointerRef.current) {
        const dt = Math.max(1, performance.now() - lastPointerRef.current.t);
        const dx = p.clientX - lastPointerRef.current.x;
        const dy = p.clientY - lastPointerRef.current.y;
        velocityRef.current.vx = dx / (dt / (1000 / 60)); // normalized
        velocityRef.current.vy = dy / (dt / (1000 / 60));
      }
      lastPointerRef.current = { t: performance.now(), x: p.clientX, y: p.clientY };

      // move target by delta
      targetRef.current.tx += (p.clientX - window.innerWidth / 2) * 0; // inert placeholder
      // better: compute delta based on movement relative to previous frame
      // we already computed velocity; apply velocity directly to transform target
      targetRef.current.tx += (p.clientX - lastPointerRef.current.x) || 0;
      targetRef.current.ty += (p.clientY - lastPointerRef.current.y) || 0;
      // clamp scale and position after change (basic clamp)
      targetRef.current.scale = clamp(targetRef.current.scale, 0.3, 4);
      startLoop();
    } else if (pts.length >= 2) {
      // pinch
      const [a, b] = pts;
      const dist = getDistanceBetween(a, b);
      const mid = getMidpoint(a, b);

      // store previous midpoint/scale in ref
      if (!(targetRef as any)._lastPinchDistance) (targetRef as any)._lastPinchDistance = dist;
      const prevDist = (targetRef as any)._lastPinchDistance as number;
      if (!prevDist) (targetRef as any)._lastPinchDistance = dist;
      const scaleFactor = dist / prevDist;

      // update target scale around midpoint
      const prevScale = targetRef.current.scale;
      const newScale = clamp(prevScale * scaleFactor, 0.3, 4);

      // To make zoom centered under mid point we need to adjust translation so the point under the fingers remains fixed.
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && imgRef.current) {
        const imgRect = imgRef.current.getBoundingClientRect();
        // coordinates relative to image center
        const cx = mid.x - (imgRect.left + imgRect.width / 2);
        const cy = mid.y - (imgRect.top + imgRect.height / 2);
        // update target tx/ty to keep focal point under fingers
        targetRef.current.tx = targetRef.current.tx - (newScale / prevScale - 1) * cx;
        targetRef.current.ty = targetRef.current.ty - (newScale / prevScale - 1) * cy;
      }

      targetRef.current.scale = newScale;
      (targetRef as any)._lastPinchDistance = dist;
      startLoop();
    }
  };

  const onPointerUp = (e: React.P) => {
    pointers.current.delete(e.pointerId);
    (e.target as Element).releasePointerCapture?.(e.pointerId);

    // reset last pinch distance
    (targetRef as any)._lastPinchDistance = null;
    lastPointerRef.current = null;

    // fling will continue because velocityRef is still set and startLoop runs until velocities dampened
    startLoop();
  };

  useEffect(() => {
    // initial reset when image changes
    transformRef.current = { tx: 0, ty: 0, scale: 1 };
    targetRef.current = { tx: 0, ty: 0, scale: 1 };
    velocityRef.current = { vx: 0, vy: 0 };
    applyTransformToNode();
  }, [currentImageUri]);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (rafTickRef.current) cancelAnimationFrame(rafTickRef.current);
    };
  }, []);

  // ---------- Canvas operations ----------
  const applyCanvasOperations = useCallback(
    (quality = 0.92) =>
      new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = currentImageUri;
        img.onload = () => {
          try {
            // create canvas sized to natural
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("No canvas context");
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", quality));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = (err) => reject(err);
      }),
    [currentImageUri, brightness, contrast, saturation]
  );

  const pushUndo = (uri: string) => setUndoStack((s) => [uri, ...s.slice(0, 9)]);

  const handleSave = async () => {
    setIsProcessing(true);
    setProcessingMessage("Saving...");
    try {
      const finalImage = await applyCanvasOperations();
      pushUndo(currentImageUri);
      setCurrentImageUri(finalImage);
      onSave(finalImage);
    } catch (e) {
      console.error(e);
      alert("Error saving image");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("Processing...");
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    setProcessingMessage("Exporting...");
    try {
      const finalImage = await applyCanvasOperations();
      const blob = await (await fetch(finalImage)).blob();
      const file = new File([blob], `EasyPix_${Date.now()}.jpg`, { type: "image/jpeg" });
      if ((navigator as any).share) {
        await (navigator as any).share({ files: [file], title: "Edited with EasyPix" });
      } else {
        const a = document.createElement("a");
        a.href = finalImage;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
      alert("Export failed");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("Processing...");
    }
  };

  const handleUndo = () => {
    const [latest, ...rest] = undoStack;
    if (latest) {
      setCurrentImageUri(latest);
      setUndoStack(rest);
    }
  };

  // --------- Remove background ----------
  const handleBackgroundRemove = async () => {
    setIsProcessing(true);
    setProcessingMessage("Removing background...");
    try {
      const result = await removeBackground(currentImageUri);
      pushUndo(currentImageUri);
      setCurrentImageUri(result);
    } catch (err) {
      console.error("BG remove failed:", err);
      alert("Background removal failed.");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("Processing...");
    }
  };

  // --------- Import overlay file ----------
  const importRef = useRef<HTMLInputElement | null>(null);
  const handleImportClick = () => importRef.current?.click();

  const handleImageImport = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    const rdr = new FileReader();
    rdr.onload = () => {
      const src = String(rdr.result);
      // place overlay centered at smaller size
      const container = containerRef.current;
      if (!container) {
        setOverlay({ src, x: 20, y: 20, width: 200, height: 200, opacity: 1 });
      } else {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const width = Math.min(240, w * 0.5);
        const aspect = 1;
        setOverlay({
          src,
          x: (w - width) / 2,
          y: (h - width * aspect) / 2,
          width,
          height: width * aspect,
          opacity: 1,
        });
      }
    };
    rdr.readAsDataURL(f);
    if (ev.target) ev.target.value = "";
    setActiveTool("import");
  };

  const handleApplyOverlay = async () => {
    if (!overlay) return;
    setIsProcessing(true);
    setProcessingMessage("Applying overlay...");
    try {
      const main = new Image();
      main.crossOrigin = "anonymous";
      main.src = currentImageUri;
      await new Promise((r) => (main.onload = r));
      const ov = new Image();
      ov.crossOrigin = "anonymous";
      ov.src = overlay.src;
      await new Promise((r) => (ov.onload = r));
      const canvas = document.createElement("canvas");
      canvas.width = main.naturalWidth;
      canvas.height = main.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(main, 0, 0);
      // scale overlay proportions from container to natural size
      const container = containerRef.current!;
      const scaleX = main.naturalWidth / container.clientWidth;
      const scaleY = main.naturalHeight / container.clientHeight;
      ctx.globalAlpha = overlay.opacity;
      ctx.drawImage(ov, overlay.x * scaleX, overlay.y * scaleY, overlay.width * scaleX, overlay.height * scaleY);
      const newUri = canvas.toDataURL("image/png");
      pushUndo(currentImageUri);
      setCurrentImageUri(newUri);
      setOverlay(null);
      setActiveTool(null);
    } catch (err) {
      console.error(err);
      alert("Apply overlay failed");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("Processing...");
    }
  };

  // ---------- nice UI helpers ----------
  useEffect(() => {
    // apply css safe area top margin to header to avoid notch overlap on iOS/Android webviews
    const header = document.querySelector("header");
    if (header) {
      (header as HTMLElement).style.paddingTop = "env(safe-area-inset-top, 12px)";
    }
  }, []);

  // ---------- Render ----------
  const tools = [
    { name: "Crop", icon: CropIcon, tool: "crop" as Tool, handler: () => setActiveTool("crop") },
    { name: "Ratio", icon: AspectRatioIcon, tool: "ratio" as Tool, handler: () => setActiveTool("ratio") },
    { name: "Flip", icon: FlipHorizontalIcon, tool: "flip" as Tool, handler: () => setActiveTool("flip") },
    { name: "Compress", icon: CompressIcon, tool: "compress" as Tool, handler: () => setActiveTool("compress") },
    { name: "Enhance", icon: EnhanceIcon, tool: "enhance" as Tool, handler: () => setActiveTool("enhance") },
    { name: "Quality", icon: ImproveQualityIcon, tool: null, handler: async () => {
      setIsProcessing(true);
      setProcessingMessage("Improving quality...");
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = currentImageUri;
        await new Promise((r) => (img.onload = r));
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.filter = "brightness(105%) contrast(105%) saturate(102%)";
        ctx.drawImage(img, 0, 0);
        const newUri = canvas.toDataURL("image/jpeg", 0.95);
        pushUndo(currentImageUri);
        setCurrentImageUri(newUri);
      } catch (e) {
        console.error(e);
        alert("Improve failed");
      } finally {
        setIsProcessing(false);
        setProcessingMessage("Processing...");
      }
    }},
    { name: "Import", icon: ImagePlusIcon, tool: "import" as Tool, handler: handleImportClick },
    { name: "Remove BG", icon: RemoveBgIcon, tool: "removeBg" as Tool, handler: handleBackgroundRemove },
  ];

  // Tool modal rendering (ratio, flip, compress, enhance)
  const renderToolModal = () => {
    if (!activeTool || activeTool === "crop" || activeTool === "import") return null;
    let content: React.ReactNode = null;
    if (activeTool === "ratio") {
      const ratios = [
        { name: "1:1", w: 1, h: 1 },
        { name: "4:3", w: 4, h: 3 },
        { name: "16:9", w: 16, h: 9 },
        { name: "3:4", w: 3, h: 4 },
        { name: "9:16", w: 9, h: 16 },
      ];
      content = (
        <div>
          <h3 className="text-lg font-bold mb-4">Aspect Ratio Crop</h3>
          <div className="grid grid-cols-3 gap-2">
            {ratios.map((r) => (
              <button
                key={r.name}
                onClick={() => {
                  // apply ratio crop quickly
                  const img = new Image();
                  img.src = currentImageUri;
                  img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const targetRatio = r.w / r.h;
                    let srcW = img.naturalWidth,
                      srcH = img.naturalHeight,
                      sx = 0,
                      sy = 0;
                    const imgRatio = srcW / srcH;
                    if (imgRatio > targetRatio) {
                      // crop width
                      srcW = Math.round(srcH * targetRatio);
                      sx = Math.round((img.naturalWidth - srcW) / 2);
                    } else {
                      srcH = Math.round(srcW / targetRatio);
                      sy = Math.round((img.naturalHeight - srcH) / 2);
                    }
                    canvas.width = srcW;
                    canvas.height = srcH;
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, srcW, srcH);
                    pushUndo(currentImageUri);
                    setCurrentImageUri(canvas.toDataURL("image/png"));
                    setActiveTool(null);
                  };
                }}
                className="p-2 border rounded hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      );
    } else if (activeTool === "flip") {
      content = (
        <div>
          <h3 className="text-lg font-bold mb-4">Flip & Rotate</h3>
          <div className="flex justify-around">
            <button
              onClick={() => {
                // flip horizontally by toggling scaleX in transform
                targetRef.current.tx -= 0; // no-op but keep loop alive
                // flip by canvas apply
                const img = new Image();
                img.src = currentImageUri;
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = img.naturalWidth;
                  canvas.height = img.naturalHeight;
                  const ctx = canvas.getContext("2d")!;
                  ctx.translate(canvas.width, 0);
                  ctx.scale(-1, 1);
                  ctx.drawImage(img, 0, 0);
                  pushUndo(currentImageUri);
                  setCurrentImageUri(canvas.toDataURL("image/png"));
                  setActiveTool(null);
                };
              }}
              className="p-2 border rounded"
            >
              Flip H
            </button>
            <button
              onClick={() => {
                const img = new Image();
                img.src = currentImageUri;
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = img.naturalHeight;
                  canvas.height = img.naturalWidth;
                  const ctx = canvas.getContext("2d")!;
                  ctx.translate(canvas.width, 0);
                  ctx.rotate((90 * Math.PI) / 180);
                  ctx.drawImage(img, 0, 0);
                  pushUndo(currentImageUri);
                  setCurrentImageUri(canvas.toDataURL("image/png"));
                  setActiveTool(null);
                };
              }}
              className="p-2 border rounded"
            >
              Rotate 90°
            </button>
          </div>
        </div>
      );
    } else if (activeTool === "compress") {
      content = (
        <div>
          <h3 className="text-lg font-bold mb-4">Compress Image</h3>
          <p className="text-sm mb-2">Quality: {compressionQuality}</p>
          <input
            type="range"
            min={1}
            max={100}
            value={compressionQuality}
            onChange={(e) => setCompressionQuality(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="mt-4">
            <button
              onClick={async () => {
                setIsProcessing(true);
                setProcessingMessage("Compressing...");
                try {
                  const newData = await applyCanvasOperations(compressionQuality / 100);
                  pushUndo(currentImageUri);
                  setCurrentImageUri(newData);
                  setActiveTool(null);
                } catch (e) {
                  console.error(e);
                  alert("Compress failed");
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="w-full bg-blue-500 text-white p-2 rounded"
            >
              Apply
            </button>
          </div>
        </div>
      );
    } else if (activeTool === "enhance") {
      // live preview sliders already bound to canvas rendering via filter CSS
      content = (
        <div className="flex flex-col gap-3 fade smooth opacity-0"
          style={{
            opacity: activeTool === "enhance" ? 1 : 0,
            PointerEvent: activeTool === "enhance" ? "auto" : "none",
        }}
        >
          <h3 className="text-lg font-bold">Enhance (live preview)</h3>
          <div>
            <label className="text-sm">Brightness: {brightness}</label>
            <input type="range" min={0} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm">Contrast: {contrast}</label>
            <input type="range" min={0} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm">Saturation: {saturation}</label>
            <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} />
          </div>
          <div>
            <button
              className="w-full bg-blue-500 text-white p-2 rounded"
              onClick={async () => {
                setIsProcessing(true);
                setProcessingMessage("Applying enhancements...");
                try {
                  const newImg = await applyCanvasOperations();
                  pushUndo(currentImageUri);
                  setCurrentImageUri(newImg);
                  setActiveTool(null);
                } catch (err) {
                  console.error(err);
                  alert("Apply failed");
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              Apply Enhancements
            </button>
          </div>
        </div>
      );
    }

    return <Modal isOpen={!!activeTool && activeTool !== "crop" && activeTool !== "import"} onClose={() => setActiveTool(null)}>{content}</Modal>;
  };

  // ---------- RENDER ----------
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="p-4 rounded shadow-lg bg-gray-800 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none" />
            </svg>
            <div>{processingMessage}</div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between p-3 bg-gray-800/80 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded hover:bg-gray-700"><BackIcon /></button>
          <button onClick={handleUndo} className="p-2 rounded hover:bg-gray-700" title="Undo" disabled={undoStack.length === 0}><UndoIcon /></button>
        </div>
        <div className="text-lg font-bold">EasyPix Editor</div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="p-2 rounded hover:bg-gray-700" title="Export"><ShareIcon /></button>
          <button onClick={handleSave} className="p-2 rounded hover:bg-gray-700" title="Save"><SaveIcon /></button>
          <button onClick={toggleTheme} className="p-2 rounded hover:bg-gray-700">{theme === "light" ? <MoonIcon /> : <SunIcon />}</button>
        </div>
      </header>

      <main ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-900 flex items-center justify-center"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          ref={imgRef}
          src={currentImageUri}
          alt="editable"
          className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out"
          style={{
            // live preview for enhance tool using CSS filter to avoid costly re-render
            filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
            willChange: "transform",
            touchAction: "none", // critical for pointer gestures
          }}
          draggable={false}
        />

        {/* overlay interactive box (imported image) */}
        {overlay && (
          <div
            className="absolute border border-dashed border-green-400 bg-black/0"
            style={{
              left: overlay.x,
              top: overlay.y,
              width: overlay.width,
              height: overlay.height,
              touchAction: "none",
              transform: "translateZ(0)",
            }}
            // overlay pointer interactions are done via onPointerDown on handles in a separate, simpler way:
            onPointerDown={(ev) => {
              // start a simple drag using pointer capture
              const id = ev.pointerId;
              (ev.target as Element).setPointerCapture?.(id);
              const startX = ev.clientX;
              const startY = ev.clientY;
              const start = { x: overlay.x, y: overlay.y };
              const move = (me: PointerEvent) => {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                setOverlay((o) => (o ? { ...o, x: clamp(start.x + dx, 0, (containerRef.current?.clientWidth || 0) - o.width), y: clamp(start.y + dy, 0, (containerRef.current?.clientHeight || 0) - o.height) } : null));
              };
              const up = (ue: PointerEvent) => {
                (ev.target as Element).releasePointerCapture?.(id);
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <img src={overlay.src} alt="ov" className="w-full h-full object-contain pointer-events-none" style={{ opacity: overlay.opacity }} />
          </div>
        )}
      </main>

      {/* bottom area: crop UI or import footer */}
      {(activeTool === "crop" || activeTool === "import") ? (
        <footer className="bg-gray-800 p-3 flex items-center gap-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 12px)",
          paddingTop: 12,
          paddingLeft: 16,
          paddingRight: 16,
         }}
        >
          {activeTool === "crop" && (
            <CropTool
              image={currentImageUri}
              onCropDone={(img) => {
                pushUndo(currentImageUri);
                setCurrentImageUri(img);
                setActiveTool(null);
              }}
              onCancel={() => setActiveTool(null)}
            />
          )}

          {activeTool === "import" && (
            <div className="flex items-center gap-2 w-full">
              <button onClick={() => { setOverlay(null); setActiveTool(null); }} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
              <button onClick={handleApplyOverlay} className="px-4 py-2 bg-blue-600 rounded text-white">Apply Overlay</button>
              <div className="flex-1" />
              <label className="text-sm text-gray-300">Opacity</label>
              <input type="range" min={0} max={1} step={0.01} value={overlay?.opacity ?? 1} onChange={(e) => setOverlay((o) => o ? { ...o, opacity: parseFloat(e.target.value) } : o)} />
            </div>
          )}
        </footer>
      ) : (
          <footer className="bg-gray-800 p-2 flex gap-2 overflow-x-auto"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 12px) + 12px)",
          paddingTop: 12,
          paddingLeft: 16,
          paddingRight: 16,
         }}
          >
          <input type="file" ref={importRef} accept="image/*" onChange={handleImageImport} className="hidden" />
          <nav className="flex gap-2">
            {tools.map((t) => (
              <button key={t.name} onClick={t.handler} className="flex flex-col items-center p-2 w-20 h-20 bg-gray-700 rounded hover:bg-gray-600">
                <div className="mb-1"><t.icon /></div>
                <div className="text-xs">{t.name}</div>
              </button>
            ))}
          </nav>
        </footer>
      )}

      {renderToolModal()}
    </div>
  );
}
