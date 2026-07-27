/**
 * Client-side photo compression (owner decision D2): every photo is
 * compressed in the browser, before upload, to a 200-400KB target, plus a
 * small thumbnail. There is no server-side image processing step and no
 * external image service -- this runs on the phone's own CPU, using the
 * Canvas API the browser already has, not a new dependency.
 *
 * Browser-only (Canvas, createImageBitmap, HTMLCanvasElement.toBlob). Never
 * import this from a server action or repository -- it belongs to
 * 'use client' components in modules/field-reporting/components only.
 */

const MAIN_TARGET_MIN_BYTES = 200 * 1024;
const MAIN_TARGET_MAX_BYTES = 400 * 1024;
const MAIN_MAX_DIMENSION = 1600;
const THUMBNAIL_MAX_DIMENSION = 320;
const THUMBNAIL_TARGET_MAX_BYTES = 40 * 1024;

/** Quality steps tried in order until the blob is at or under the target -- coarse enough that a handful of attempts always terminate. */
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.25] as const;

export type CompressedPhoto = {
  readonly main: Blob;
  readonly thumbnail: Blob;
};

/**
 * Compress a photo file into a main image (200-400KB target) and a
 * thumbnail (<=40KB), both JPEG. Resizes to fit within a max dimension
 * first (most of the size reduction), then steps down JPEG quality until
 * under the target, settling for the smallest attempt if even the lowest
 * quality step is still over -- a slightly-too-large photo is better than
 * a failed upload.
 */
export async function compressPhoto(file: File | Blob): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const main = await compressToTarget(bitmap, MAIN_MAX_DIMENSION, MAIN_TARGET_MAX_BYTES);
    const thumbnail = await compressToTarget(bitmap, THUMBNAIL_MAX_DIMENSION, THUMBNAIL_TARGET_MAX_BYTES);
    return { main, thumbnail };
  } finally {
    bitmap.close();
  }
}

async function compressToTarget(bitmap: ImageBitmap, maxDimension: number, targetMaxBytes: number): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('compressPhoto: 2D canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  let smallest: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    if (smallest === null || blob.size < smallest.size) smallest = blob;
    if (blob.size <= targetMaxBytes) return blob;
  }

  // Every quality step was still over target -- return the smallest we got
  // rather than fail the upload outright.
  return smallest!;
}

function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const scale = maxDimension / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('compressPhoto: canvas.toBlob produced no blob'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

/** Exported for tests that want to assert the target band without duplicating the constants. */
export const PHOTO_COMPRESSION_TARGETS = {
  mainMinBytes: MAIN_TARGET_MIN_BYTES,
  mainMaxBytes: MAIN_TARGET_MAX_BYTES,
  thumbnailMaxBytes: THUMBNAIL_TARGET_MAX_BYTES,
} as const;
