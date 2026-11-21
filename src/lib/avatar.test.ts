import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_AVATAR_BYTES,
  PRESET_AVATARS,
  byteSizeOfDataUrl,
  computeSquareCrop,
  encodeResizedAvatar,
  isImageAvatar,
  isValidAvatar,
  resizeImageToAvatar,
} from "./avatar";

describe("avatar utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("center-crops rectangular images into a square", () => {
    expect(computeSquareCrop(1200, 800)).toEqual({ sx: 200, sy: 0, size: 800 });
    expect(computeSquareCrop(600, 1000)).toEqual({ sx: 0, sy: 200, size: 600 });
  });

  it("validates presets and raster data URLs within 30 KB and rejects unsafe/oversized inputs", () => {
    expect(isValidAvatar(null)).toBe(true);
    expect(isValidAvatar(PRESET_AVATARS[0])).toBe(true);

    const smallJpeg = `data:image/jpeg;base64,${"A".repeat(1000)}`;
    expect(isImageAvatar(smallJpeg)).toBe(true);
    expect(isValidAvatar(smallJpeg)).toBe(true);

    const tooLarge = `data:image/jpeg;base64,${"A".repeat(MAX_AVATAR_BYTES + 100)}`;
    expect(isValidAvatar(tooLarge)).toBe(false);

    const svgXss = `data:image/svg+xml;base64,${"A".repeat(100)}`;
    expect(isImageAvatar(svgXss)).toBe(false);
    expect(isValidAvatar(svgXss)).toBe(false);

    expect(isValidAvatar("https://evil.example/avatar.png")).toBe(false);
  });

  it("iteratively scales down size and quality until encoded image fits under 30 KB", () => {
    const attempts: Array<{ size: number; mime: string; quality: number }> = [];
    const result = encodeResizedAvatar((size, mime, quality) => {
      attempts.push({ size, mime, quality });
      // Pretend high sizes/qualities exceed 30 KB until size <= 96
      const len = size > 96 ? MAX_AVATAR_BYTES + 2048 : 8192;
      return `data:image/jpeg;base64,${"A".repeat(len)}`;
    });

    expect(byteSizeOfDataUrl(result)).toBeLessThanOrEqual(MAX_AVATAR_BYTES);
    expect(attempts.some((a) => a.size <= 96)).toBe(true);
  });

  it("resizes uploaded image files via canvas to <= 30 KB", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 2000, height: 1000, close })),
    );

    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ fillStyle: "", fillRect, drawImage }),
          toDataURL: (mime: string, quality: number) => {
            const payloadLen = quality > 0.7 ? MAX_AVATAR_BYTES + 5000 : 10_000;
            return `data:${mime};base64,${"B".repeat(payloadLen)}`;
          },
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tagName);
    });

    const file = new File(["fake-bytes"], "photo.png", { type: "image/png" });
    const dataUrl = await resizeImageToAvatar(file);

    expect(isImageAvatar(dataUrl)).toBe(true);
    expect(byteSizeOfDataUrl(dataUrl)).toBeLessThanOrEqual(MAX_AVATAR_BYTES);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
