"use client";

import { PHOTO_MAX_DIMENSION, PHOTO_OPTIMIZED_TARGET_BYTES } from "@/lib/photo-upload";

export async function optimizePhoto(file: File) {
  if (file.size <= PHOTO_OPTIMIZED_TARGET_BYTES) return file;
  const image = await loadPhoto(file);
  const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`No se pudo preparar la fotografía “${file.name}”.`);

  const qualities = [0.86, 0.76, 0.66, 0.56, 0.46];
  for (let pass = 0; pass < 7; pass++) {
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of qualities) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= PHOTO_OPTIMIZED_TARGET_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "fotografia";
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
      }
    }
    width = Math.max(1, Math.round(width * 0.78));
    height = Math.max(1, Math.round(height * 0.78));
  }
  throw new Error(`No se pudo optimizar automáticamente “${file.name}”. Prueba a seleccionarla de nuevo.`);
}

export async function uploadPiecePhoto(pieceId: number, file: File) {
  const response = await fetch(`/api/almacen-desguace/${pieceId}/fotos`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Photo-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  const raw = await response.text();
  let data: { error?: string } = {};
  try { data = raw ? JSON.parse(raw) as { error?: string } : {}; } catch { /* La plataforma puede devolver texto o una respuesta vacía. */ }
  if (!response.ok) {
    if (response.status === 413) throw new Error(`La fotografía “${file.name}” supera el límite del servidor incluso después de optimizarla.`);
    throw new Error(data.error || raw || `No se pudo subir la fotografía “${file.name}”.`);
  }
  return data;
}

function loadPhoto(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`No se pudo leer la fotografía “${file.name}”.`)); };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la fotografía.")),
    "image/jpeg",
    quality,
  ));
}

