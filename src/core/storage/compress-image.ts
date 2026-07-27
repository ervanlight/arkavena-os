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

export type WatermarkMetadata = {
  projectName?: string | undefined;
  zoneName?: string | undefined;
  uploaderName?: string | undefined;
  dateStr?: string | undefined;
  gpsCoords?: string | null | undefined;
};

export type CompressedPhoto = {
  readonly main: Blob;
  readonly thumbnail: Blob;
};

/**
 * Compress a photo file into a main image (200-400KB target) and a
 * thumbnail (<=40KB), both JPEG/WebP. Stamps GPS watermark & project metadata
 * onto canvas before compressing.
 */
export async function compressPhoto(
  file: File | Blob,
  watermarkMeta?: WatermarkMetadata,
): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const main = await compressToTarget(bitmap, MAIN_MAX_DIMENSION, MAIN_TARGET_MAX_BYTES, watermarkMeta);
    const thumbnail = await compressToTarget(bitmap, THUMBNAIL_MAX_DIMENSION, THUMBNAIL_TARGET_MAX_BYTES, watermarkMeta);
    return { main, thumbnail };
  } finally {
    bitmap.close();
  }
}

async function compressToTarget(
  bitmap: ImageBitmap,
  maxDimension: number,
  targetMaxBytes: number,
  watermarkMeta?: WatermarkMetadata,
): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('compressPhoto: 2D canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  if (watermarkMeta) {
    drawWatermarkOnCanvas(ctx, width, height, watermarkMeta);
  }

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

function drawWatermarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  meta: WatermarkMetadata,
) {
  const scale = Math.max(width, height) / 1200;
  const fontSize = Math.max(13, Math.round(17 * scale));
  const padding = Math.max(10, Math.round(14 * scale));
  const lineHeight = Math.round(fontSize * 1.35);

  const lines: string[] = [];
  if (meta.projectName || meta.zoneName) {
    const proj = meta.projectName ?? 'Arkavena OS';
    const zone = meta.zoneName ? ` • ${meta.zoneName}` : '';
    lines.push(`📌 ${proj}${zone}`);
  }
  if (meta.uploaderName) {
    lines.push(`👤 ${meta.uploaderName}`);
  }
  const dateText = meta.dateStr ?? new Date().toLocaleString('id-ID');
  const gpsText = meta.gpsCoords ? ` | 🌐 ${meta.gpsCoords}` : '';
  lines.push(`⏰ ${dateText}${gpsText}`);

  ctx.font = `600 ${fontSize}px sans-serif`;

  let maxLineWidth = 0;
  lines.forEach((line) => {
    const textWidth = ctx.measureText(line).width;
    if (textWidth > maxLineWidth) maxLineWidth = textWidth;
  });

  const boxWidth = maxLineWidth + padding * 2;
  const boxHeight = lines.length * lineHeight + padding * 1.5;
  const margin = Math.max(10, Math.round(16 * scale));

  const x = margin;
  const y = height - boxHeight - margin;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  const radius = Math.max(6, Math.round(8 * scale));

  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    ctx.fill();

    // Accent line on left
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(4, Math.round(6 * scale)), boxHeight, [radius, 0, 0, radius]);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, boxWidth, boxHeight);
  }

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;

  lines.forEach((line, index) => {
    const textY = y + padding + index * lineHeight + fontSize * 0.8;
    ctx.fillText(line, x + padding + 4, textY);
  });

  ctx.restore();
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
