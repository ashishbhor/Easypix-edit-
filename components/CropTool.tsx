import React, { useEffect, useRef, useState } from "react";

interface CropToolProps {
  image: string; // dataURL or URL
  onCropDone: (dataUrl: string) => void;
  onCancel: () => void;
}

// Lightweight crop UI — draws a draggable/resizable rect overlay on top of the image
export default function CropTool({ image, onCropDone, onCancel }: CropToolProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState({ x: 40, y: 40, w: 200, h: 200 });
  const dragRef = useRef<{ mode: string | null; startX: number; startY: number; startCrop: any } | null>(null);

  useEffect(() => {
    // center crop when image loads
    const img = new Image();
    img.src = image;
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const size = Math.min(w, h) * 0.6;
      setCrop({ x: (w - size) / 2, y: (h - size) / 2, w: size, h: size });
    };
  }, [image]);

  const startDrag = (mode: string, e: React.PointerEvent) => {
    const id = e.pointerId;
    (e.target as Element).setPointerCapture?.(id);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };
  };

  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { mode, startX, startY, startCrop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const cont = containerRef.current!;
    const clamp = (v: number, a = 0, b = 1e9) => Math.max(a, Math.min(b, v));
    if (mode === "move") {
      setCrop((c) => ({ ...c, x: clamp(startCrop.x + dx, 0, cont.clientWidth - c.w), y: clamp(startCrop.y + dy, 0, cont.clientHeight - c.h) }));
    } else if (mode === "se") {
      setCrop((c) => ({ ...c, w: clamp(startCrop.w + dx, 40, cont.clientWidth - startCrop.x), h: clamp(startCrop.h + dy, 40, cont.clientHeight - startCrop.y) }));
    } else if (mode === "nw") {
      const nx = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.w - 40);
      const ny = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.h - 40);
      setCrop((c) => ({ ...c, x: nx, y: ny, w: startCrop.w + (startCrop.x - nx), h: startCrop.h + (startCrop.y - ny) }));
    }
    // other handles can be added similarly
  };

  const endDrag = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  const applyCrop = () => {
    const img = imgRef.current!;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const rect = img.getBoundingClientRect();
    // compute scale from display to natural
    const scaleX = naturalW / rect.width;
    const scaleY = naturalH / rect.height;
    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.round(crop.w * scaleX);
    const sh = Math.round(crop.h * scaleY);
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d")!;
    const imageEl = new Image();
    imageEl.crossOrigin = "anonymous";
    imageEl.src = image;
    imageEl.onload = () => {
      ctx.drawImage(imageEl, sx, sy, sw, sh, 0, 0, sw, sh);
      const data = canvas.toDataURL("image/png");
      onCropDone(data);
    };
  };

  return (
    <div ref={containerRef} className="relative flex-1" style={{ height: 220 }}>
      <img ref={imgRef} src={image} alt="crop preview" className="w-full h-full object-contain pointer-events-none" draggable={false} />
      <div
        className="absolute border-2 border-blue-400 bg-blue-500/10"
        style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, touchAction: "none" }}
        onPointerDown={(e) => startDrag("move", e)}
        onPointerMove={(e) => onMove(e)}
        onPointerUp={(e) => endDrag(e)}
      >
        <div style={{ position: "absolute", right: -8, bottom: -8, width: 16, height: 16, background: "white", borderRadius: 4, cursor: "nwse-resize" }} onPointerDown={(e) => startDrag("se", e)} />
        <div style={{ position: "absolute", left: -8, top: -8, width: 16, height: 16, background: "white", borderRadius: 4, cursor: "nwse-resize" }} onPointerDown={(e) => startDrag("nw", e)} />
      </div>

      <div className="flex gap-2 mt-2">
        <button onClick={onCancel} className="px-4 py-2 bg-gray-600 rounded">Cancel</button>
        <button onClick={applyCrop} className="px-4 py-2 bg-blue-600 text-white rounded">Apply Crop</button>
      </div>
    </div>
  );
}
