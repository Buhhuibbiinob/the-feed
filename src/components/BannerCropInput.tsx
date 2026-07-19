"use client";

import { useRef, useState } from "react";

// A dependency-free banner cropper: pick a photo, then use two sliders to
// choose which part of it shows in a fixed-aspect-ratio frame (the same idea
// as CSS object-position, but rendered to a real cropped image via canvas so
// the server only ever receives the exact crop, not the original photo).
export function BannerCropInput({
  name,
  aspectRatio = 3,
  outputWidth = 1200,
}: {
  name: string;
  aspectRatio?: number;
  outputWidth?: number;
}) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const [cropped, setCropped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewportWidth = 320;
  const viewportHeight = Math.round(viewportWidth / aspectRatio);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgSrc(URL.createObjectURL(file));
    setPosX(50);
    setPosY(50);
    setCropped(false);
    setError(null);
  }

  function applyCrop(x = posX, y = posY) {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;

    const boxAspect = viewportWidth / viewportHeight;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const scale =
      imgAspect > boxAspect ? img.naturalHeight / viewportHeight : img.naturalWidth / viewportWidth;

    const sourceWidth = viewportWidth * scale;
    const sourceHeight = viewportHeight * scale;
    const excessX = img.naturalWidth - sourceWidth;
    const excessY = img.naturalHeight - sourceHeight;
    const sourceX = Math.max(0, excessX * (x / 100));
    const sourceY = Math.max(0, excessY * (y / 100));

    const outputHeight = Math.round(outputWidth / aspectRatio);
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);

    canvas.toBlob(
      (blob) => {
        if (!blob || !hiddenInputRef.current) return;
        const file = new File([blob], "banner.jpg", { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        hiddenInputRef.current.files = dt.files;
        setCropped(true);
        setError(null);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="banner-crop">
      <input type="file" accept="image/*" onChange={handlePick} />
      <input type="file" name={name} ref={hiddenInputRef} style={{ display: "none" }} />
      {error && <div className="form-error">{error}</div>}

      {imgSrc && (
        <>
          <div
            className="banner-crop-viewport"
            style={{ width: viewportWidth, height: viewportHeight }}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              style={{ objectPosition: `${posX}% ${posY}%` }}
              onLoad={() => applyCrop()}
            />
          </div>
          <div className="banner-crop-controls">
            <label>
              Horizontal
              <input
                type="range"
                min={0}
                max={100}
                value={posX}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPosX(v);
                  applyCrop(v, posY);
                }}
              />
            </label>
            <label>
              Vertical
              <input
                type="range"
                min={0}
                max={100}
                value={posY}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPosY(v);
                  applyCrop(posX, v);
                }}
              />
            </label>
          </div>
          <div className="field-hint">{cropped ? "Crop ready." : "Adjust the sliders to frame your banner."}</div>
        </>
      )}
    </div>
  );
}
