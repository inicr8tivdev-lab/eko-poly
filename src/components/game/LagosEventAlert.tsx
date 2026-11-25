import { useEffect, useState } from "react";
import { Clock, MapPin, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  describeEventEffect,
  describeEventScope,
  getEventVisualTheme,
  type LagosEvent,
} from "@/game/events";
import { cn } from "@/lib/utils";

export function LagosEventAlert({
  activeEvent,
  round,
  expiresAt,
}: {
  activeEvent: LagosEvent | null;
  round: number;
  expiresAt: number;
}) {
  const [showModal, setShowModal] = useState(false);
  const [lastEventKey, setLastEventKey] = useState<string | null>(null);

  const eventKey = activeEvent ? `${activeEvent.id}-${expiresAt}` : null;

  useEffect(() => {
    if (eventKey && eventKey !== lastEventKey) {
      setLastEventKey(eventKey);
      setShowModal(true);
    } else if (!eventKey && lastEventKey !== null) {
      setLastEventKey(null);
      setShowModal(false);
    }
  }, [eventKey, lastEventKey]);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  if (!activeEvent) return null;

  const roundsLeft = Math.max(1, expiresAt - round);
  const effectSummary = describeEventEffect(activeEvent);
  const scopeLabel = describeEventScope(activeEvent);
  const theme = getEventVisualTheme(activeEvent);

  const toneBannerCls = {
    alert: "border-destructive/50 from-card via-card/95 to-destructive/15",
    boost: "border-emerald-500/45 from-card via-card/95 to-emerald-500/15",
    surge: "border-primary/45 from-card via-card/95 to-primary/15",
  }[theme.tone];

  const toneBadgeCls = {
    alert: "bg-destructive/15 text-destructive",
    boost: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    surge: "bg-primary/20 text-primary",
  }[theme.tone];

  return (
    <>
      {/* Active Event Banner */}
      <div
        role="status"
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-gradient-to-r px-4 py-2.5 shadow-sm",
          toneBannerCls,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl shadow-inner">
            {activeEvent.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider",
                  toneBadgeCls,
                )}
              >
                Lagos Event · {theme.label}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                {scopeLabel}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
                {roundsLeft} {roundsLeft === 1 ? "round left" : "rounds left"}
              </span>
            </div>
            <p className="truncate font-display text-sm font-black">{activeEvent.title}</p>
            <p className="truncate text-xs text-muted-foreground">{effectSummary}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => setShowModal(true)}
        >
          Details
        </Button>
      </div>

      {/* Pop-up Event Notification */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lagos-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="animate-card-in relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-board">
            <div className="h-2.5 bg-danfo" />
            <div className="p-6">
              <button
                type="button"
                aria-label="Close event notification"
                onClick={() => setShowModal(false)}
                className="absolute right-4 top-5 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
              <div className="flex items-center gap-3 pr-8">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-3xl shadow-inner">
                  {activeEvent.icon}
                </span>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3" /> Dynamic Lagos Event
                  </span>
                  <h2
                    id="lagos-event-title"
                    className="mt-1 font-display text-lg font-black leading-tight"
                  >
                    {activeEvent.title}
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {activeEvent.description}
              </p>
              <div className="mt-5 space-y-2 rounded-2xl border border-border/80 bg-secondary/70 p-4 text-xs">
                <p className="font-display text-[11px] font-bold uppercase tracking-wider text-primary">
                  Active Effect
                </p>
                <p className="text-sm font-semibold text-foreground">{effectSummary}</p>
                <div className="flex flex-wrap gap-3 pt-1 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 text-primary" /> {scopeLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5 text-primary" /> Lasts {activeEvent.durationRounds}{" "}
                    {activeEvent.durationRounds === 1 ? "round" : "rounds"} ({roundsLeft} left)
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <Button
                  variant="danfo"
                  size="lg"
                  className="w-full"
                  onClick={() => setShowModal(false)}
                >
                  Got it, continue game
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
