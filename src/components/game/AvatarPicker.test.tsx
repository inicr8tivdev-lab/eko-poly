import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGame } from "@/game/engine";
import { MAX_AVATAR_BYTES, byteSizeOfDataUrl } from "@/lib/avatar";
import { AvatarPicker } from "./AvatarPicker";
import { Board } from "./Board";

describe("AvatarPicker and Board game piece avatars", () => {
  it("renders custom photo and preset avatars directly on Board game pieces", () => {
    const photo = `data:image/webp;base64,${"A".repeat(500)}`;
    const state = createGame([
      { name: "Ada", isCpu: false, avatar: photo },
      { name: "Tunde", isCpu: false, avatar: "🦁" },
    ]);

    render(
      <Board state={state} selected={null} onSelect={() => {}}>
        <div />
      </Board>,
    );

    const img = screen.getByAltText("Ada's avatar");
    expect(img).toHaveAttribute("src", photo);
    expect(screen.getByText("🦁")).toBeInTheDocument();
  });

  it("lets a player select a preset avatar or upload and resize an image to <= 30 KB", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 800, height: 600, close })),
    );

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() }),
          toDataURL: () => `data:image/jpeg;base64,${"C".repeat(4096)}`,
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tagName);
    });

    const onChange = vi.fn();
    render(<AvatarPicker seatIndex={0} name="Ada" avatar={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose avatar for Ada" }));
    fireEvent.click(screen.getByRole("button", { name: "Select avatar 👑" }));
    expect(onChange).toHaveBeenCalledWith("👑");

    fireEvent.click(screen.getByRole("button", { name: "Choose avatar for Ada" }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["img"], "selfie.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(2);
    });
    const uploaded = onChange.mock.calls[1]?.[0] as string;
    expect(uploaded.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(byteSizeOfDataUrl(uploaded)).toBeLessThanOrEqual(MAX_AVATAR_BYTES);
  });
});
