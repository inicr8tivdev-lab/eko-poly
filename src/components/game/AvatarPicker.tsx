import { useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tokenOf } from "@/game/engine";
import {
  PRESET_AVATARS,
  formatAvatarBytes,
  isImageAvatar,
  resizeImageToAvatar,
} from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { AvatarCircle } from "./PlayerAvatar";

interface AvatarPickerProps {
  seatIndex: number;
  name: string;
  avatar?: string | null | undefined;
  onChange: (next: string | null) => void;
  sizeClassName?: string | undefined;
  ariaLabel?: string | undefined;
}

export function AvatarPicker({
  seatIndex,
  name,
  avatar,
  onChange,
  sizeClassName = "size-10 text-xl",
  ariaLabel,
}: AvatarPickerProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const token = tokenOf(seatIndex);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const resized = await resizeImageToAvatar(file);
      onChange(resized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={ariaLabel ?? `Choose avatar for ${name || `Player ${seatIndex + 1}`}`}
        title="Customize game piece avatar"
        className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AvatarCircle
          seatIndex={seatIndex}
          avatar={avatar}
          name={name}
          className={cn(
            sizeClassName,
            "ring-2 ring-transparent transition group-hover:ring-primary",
          )}
        />
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm">
          <Camera className="size-2.5" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Choose game piece avatar</DialogTitle>
            <DialogDescription>
              Pick a preset icon or upload a photo for {name || `Player ${seatIndex + 1}`}. Photos
              automatically resize to under 30 KB and appear on your board piece.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary/40 p-3">
            <AvatarCircle
              seatIndex={seatIndex}
              avatar={avatar}
              name={name}
              className="size-14 border-2 border-board-line text-2xl shadow-pop"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name || `Player ${seatIndex + 1}`}</p>
              <p className="text-xs text-muted-foreground">
                {isImageAvatar(avatar)
                  ? `Custom photo · ${formatAvatarBytes(avatar)}`
                  : avatar
                    ? `Preset avatar ${avatar}`
                    : `Default ${token.label} (${token.emoji})`}
              </p>
            </div>
            {avatar && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
                aria-label="Reset to default board token"
              >
                <RotateCcw className="size-4" />
              </Button>
            )}
          </div>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFile(e)}
            />
            <Button
              type="button"
              variant="danfo"
              className="w-full"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {uploading ? "Resizing photo…" : "Upload photo (auto ≤ 30 KB)"}
            </Button>
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Presets
            </p>
            <div className="grid grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onChange(null);
                  setOpen(false);
                }}
                aria-label={`Default ${token.label}`}
                title={`Default ${token.label}`}
                className={cn(
                  "flex h-10 items-center justify-center rounded-lg border text-xl transition",
                  !avatar
                    ? "border-primary bg-primary/15"
                    : "border-border bg-secondary/60 hover:border-muted-foreground",
                )}
              >
                {token.emoji}
              </button>
              {PRESET_AVATARS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setError(null);
                    onChange(preset);
                    setOpen(false);
                  }}
                  aria-label={`Select avatar ${preset}`}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border text-xl transition",
                    avatar === preset
                      ? "border-primary bg-primary/15"
                      : "border-border bg-secondary/60 hover:border-muted-foreground",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
