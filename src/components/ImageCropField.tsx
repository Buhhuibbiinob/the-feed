"use client";

import { useEffect, useRef, useState } from "react";

type Offset = { x: number; y: number };
type NaturalSize = { w: number; h: number };

// A pick-then-crop file field: the user chooses a raw image, then can pan
// (drag) and zoom (slider) it within a box matching the target slot's real
// aspect ratio before it's submitted. The cropped result is rendered to a
// canvas at the slot's real pixel size and swapped onto a hidden file
// input under `name`, so the surrounding <form action={...}> keeps working
// unchanged. Pass a different `key` from the parent when the target size
// changes so the crop state resets cleanly for the new shape.
export function ImageCropField({
  id,
  name,
  label,
  hint,
  targetWidth,
  targetHeight,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  targetWidth: number;
  targetHeight: number;
}) {
  const aspectRatio = targetWidth / targetHeight;
  // On-screen crop box is capped to a manageable size - the exported image
  // is still rendered at the real targetWidth/targetHeight.
  const boxWidth = Math.min(targetWidth, 320);
  const boxHeight = Math.round(boxWidth / aspectRatio);

  const pickerInputRef = useRef<HTMLInputElement>(null);
  const submitInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startOffset: Offset } | null>(null);

  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<NaturalSize>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const baseScale = naturalSize.w && naturalSize.h ? Math.max(boxWidth / naturalSize.w, boxHeight / naturalSize.h) : 1;
  const scale = baseScale * zoom;
  const dispW = naturalSize.w * scale;
  const dispH = naturalSize.h * scale;

  function clampOffset(next: Offset, dW: number, dH: number): Offset {
    const minX = Math.min(0, boxWidth - dW);
    const minY = Math.min(0, boxHeight - dH);
    return { x: Math.max(minX, Math.min(0, next.x)), y: Math.max(minY, Math.min(0, next.y)) };
  }

  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
    };
  }, [srcUrl]);

  // Regenerate the cropped image and push it onto the real submit input
  // whenever the crop changes, so the form always has the current result.
  useEffect(() => {
    if (!srcUrl || !imgRef.current || !naturalSize.w || !submitInputRef.current) return;
    const timer = setTimeout(() => {
      const img = imgRef.current;
      const target = submitInputRef.current;
      if (!img || !target) return;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sW = boxWidth / scale;
      const sH = boxHeight / scale;
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const croppedFile = new File([blob], "banner.jpg", { type: "image/jpeg" });
          const dt = new DataTransfer();
          dt.items.add(croppedFile);
          target.files = dt.files;
        },
        "image/jpeg",
        0.92
      );
    }, 120);
    return () => clearTimeout(timer);
  }, [srcUrl, naturalSize, offset, scale, boxWidth, boxHeight, targetWidth, targetHeight]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (!file) {
      setSrcUrl(null);
      return;
    }
    setSrcUrl(URL.createObjectURL(file));
    setZoom(1);
  }

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ w, h });
    const bs = Math.max(boxWidth / w, boxHeight / h);
    setOffset({ x: (boxWidth - w * bs) / 2, y: (boxHeight - h * bs) / 2 });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!srcUrl) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(
      clampOffset(
        { x: dragRef.current.startOffset.x + dx, y: dragRef.current.startOffset.y + dy },
        dispW,
        dispH
      )
    );
  }

  function handlePointerUp() {
    dragRef.current = null;
    setIsDragging(false);
  }

  function handleZoom(e: React.ChangeEvent<HTMLInputElement>) {
    const newZoom = Number(e.target.value);
    const newScale = baseScale * newZoom;
    const centerXImg = (boxWidth / 2 - offset.x) / scale;
    const centerYImg = (boxHeight / 2 - offset.y) / scale;
    const newDispW = naturalSize.w * newScale;
    const newDispH = naturalSize.h * newScale;
    setZoom(newZoom);
    setOffset(
      clampOffset(
        { x: boxWidth / 2 - centerXImg * newScale, y: boxHeight / 2 - centerYImg * newScale },
        newDispW,
        newDispH
      )
    );
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label} ({targetWidth} × {targetHeight}px)
      </label>
      <input
        ref={pickerInputRef}
        id={id}
        type="file"
        accept="image/*"
        onChange={handlePick}
      />
      <input ref={submitInputRef} type="file" name={name} style={{ display: "none" }} />
      {hint && <div className="field-hint">{hint}</div>}

      {srcUrl && (
        <div style={{ marginTop: 10 }}>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{
              width: boxWidth,
              height: boxHeight,
              overflow: "hidden",
              position: "relative",
              borderRadius: 6,
              border: "1px solid var(--panel-border, #ccc)",
              cursor: isDragging ? "grabbing" : "grab",
              touchAction: "none",
              background: "#e5e5e5",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={srcUrl}
              alt=""
              onLoad={handleImgLoad}
              draggable={false}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: dispW || undefined,
                height: dispH || undefined,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                maxWidth: "none",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, maxWidth: boxWidth }}>
            <span style={{ fontSize: 11 }}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={handleZoom}
              style={{ flex: 1 }}
            />
          </div>
          <div className="field-hint">Drag to reposition, use the slider to zoom.</div>
        </div>
      )}
    </div>
  );
}
