import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { isMusicEnabled, subscribeMusic, toggleMusic } from "@/lib/music";
import { cn } from "@/lib/utils";

function useMusicEnabled(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isMusicEnabled());
    return subscribeMusic(setEnabled);
  }, []);

  return [enabled, () => toggleMusic()];
}

export function MusicToggle({
  compactOnMobile = true,
  variant = "ghost",
  size = "sm",
  className,
}: {
  compactOnMobile?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [musicOn, toggle] = useMusicEnabled();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggle}
      aria-label={musicOn ? "Turn music off" : "Turn music on"}
      aria-pressed={musicOn}
      className={cn(!musicOn && "text-muted-foreground", className)}
    >
      <span className="relative inline-flex items-center justify-center">
        <Music className={cn(!musicOn && "opacity-55")} />
        {!musicOn && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-[1.5px] w-4.5 -rotate-45 rounded-full bg-current"
          />
        )}
      </span>
      <span className={compactOnMobile ? "hidden sm:inline" : undefined}>
        {musicOn ? "Music on" : "Music off"}
      </span>
    </Button>
  );
}
