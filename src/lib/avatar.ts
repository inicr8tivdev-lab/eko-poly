export const MAX_AVATAR_BYTES = 30 * 1024; // 30 KB
export const AVATAR_STORAGE_KEY = "ekopoly-avatar-v1";

export const PRESET_AVATARS = [
  "🦁",
  "👑",
  "😎",
  "🥁",
  "🦅",
  "🌴",
  "⚡",
  "🎭",
  "🐊",
  "🦊",
  "💎",
  "🎷",
] as const;

const DATA_IMAGE_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isImageAvatar(avatar?: string | null): avatar is string {
  return typeof avatar === "string" && DATA_IMAGE_RE.test(avatar);
}

export function byteSizeOfDataUrl(dataUrl: string): number {
  return new TextEncoder().encode(dataUrl).length;
}

export function isValidAvatar(avatar?: string | null): boolean {
  if (avatar == null || avatar === "") return true;
  if (isImageAvatar(avatar)) {
    return byteSizeOfDataUrl(avatar) <= MAX_AVATAR_BYTES;
  }
  return (PRESET_AVATARS as readonly string[]).includes(avatar);
}

export function computeSquareCrop(width: number, height: number): { sx: number; sy: number; size: number } {
  const w = Math.max(1, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const size = Math.min(w, h);
  return {
    sx: Math.floor((w - size) / 2),
    sy: Math.floor((h - size) / 2),
    size,
  };
}

export function encodeResizedAvatar(
  render: (size: number, mime: string, quality: number) => string,
  maxBytes: number = MAX_AVATAR_BYTES,
): string {
  const sizes = [160, 128, 96, 64, 48];
  const qualities = [0.88, 0.74, 0.6, 0.45, 0.32];
  const mimes = ["image/webp", "image/jpeg"];

  let smallest = "";
  let smallestLen = Number.POSITIVE_INFINITY;

  for (const size of sizes) {
    for (const quality of qualities) {
      for (const mime of mimes) {
        const dataUrl = render(size, mime, quality);
        if (!isImageAvatar(dataUrl)) continue;
        const bytes = byteSizeOfDataUrl(dataUrl);
        if (bytes < smallestLen) {
          smallest = dataUrl;
          smallestLen = bytes;
        }
        if (bytes <= maxBytes) {
          return dataUrl;
        }
      }
    }
  }

  if (smallest && smallestLen <= maxBytes) return smallest;
  throw new Error("Could not resize image within 30 KB. Try a simpler image.");
}

async function loadImageSource(file: File): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number) => void;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, sx, sy, sw, sh, dw, dh) => ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement below
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image file."));
      el.src = url;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, sx, sy, sw, sh, dw, dh) => ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh),
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export async function resizeImageToAvatar(file: File, maxBytes: number = MAX_AVATAR_BYTES): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Please select an image file (PNG, JPG, WebP, or GIF).");
  }
  const source = await loadImageSource(file);
  try {
    const { sx, sy, size: cropSize } = computeSquareCrop(source.width, source.height);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");

    return encodeResizedAvatar((targetSize, mime, quality) => {
      canvas.width = targetSize;
      canvas.height = targetSize;
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, 0, targetSize, targetSize);
      source.draw(ctx, sx, sy, cropSize, cropSize, targetSize, targetSize);
      return canvas.toDataURL(mime, quality);
    }, maxBytes);
  } finally {
    source.cleanup();
  }
}

export function formatAvatarBytes(dataUrl: string): string {
  const bytes = byteSizeOfDataUrl(dataUrl);
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function loadSavedAvatar(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw || !isValidAvatar(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function saveLocalAvatar(avatar: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!avatar) {
      window.localStorage.removeItem(AVATAR_STORAGE_KEY);
      return;
    }
    if (isValidAvatar(avatar)) {
      window.localStorage.setItem(AVATAR_STORAGE_KEY, avatar);
    }
  } catch {
    /* ignore storage quota or privacy mode errors */
  }
}
