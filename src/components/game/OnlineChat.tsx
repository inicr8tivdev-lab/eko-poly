import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_CHAT_LENGTH, QUICK_CHAT_PHRASES, cleanChatText, type ChatMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { PLAYER_BG } from "./styles";

export interface OnlineChatConfig {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void> | void;
  sending?: boolean | undefined;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OnlineChat({
  messages,
  viewerSeat,
  onSend,
  sending = false,
  onClose,
  autoFocus = false,
  title = "Table chat",
  className,
}: {
  messages: ChatMessage[];
  viewerSeat?: number | undefined;
  onSend: (text: string) => Promise<void> | void;
  sending?: boolean | undefined;
  onClose?: (() => void) | undefined;
  autoFocus?: boolean | undefined;
  title?: string | undefined;
  className?: string | undefined;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const submitText = (raw: string) => {
    const cleaned = cleanChatText(raw);
    if (!cleaned) return;
    setDraft("");
    void onSend(cleaned);
  };

  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <MessageSquare className="size-3.5 text-primary" />
          {title}
          {messages.length > 0 && (
            <span className="font-sans text-[11px] font-semibold tracking-normal text-muted-foreground/80">
              ({messages.length})
            </span>
          )}
        </p>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onClose}
            aria-label="Close chat"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div
        ref={listRef}
        className="max-h-52 min-h-28 space-y-2 overflow-y-auto px-4 py-3 text-sm"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No messages yet — say hello or drop some Eko banter!
          </p>
        ) : (
          messages.map((m) => {
            const isMine = viewerSeat !== undefined && m.seat === viewerSeat;
            const timeLabel = formatMessageTime(m.sentAt);
            return (
              <div key={m.id} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    PLAYER_BG[m.seat % PLAYER_BG.length],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isMine ? "text-primary" : "text-foreground",
                      )}
                    >
                      {m.sender}
                      {isMine ? " (You)" : ""}
                    </span>
                    {timeLabel && (
                      <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
                    )}
                  </div>
                  <p className="break-words text-sm leading-snug text-card-foreground/95">
                    {m.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-border/60 bg-background/40 px-3 py-1.5">
        {QUICK_CHAT_PHRASES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => submitText(phrase)}
            className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground transition hover:border-primary hover:text-primary"
          >
            {phrase}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          submitText(draft);
        }}
      >
        <Input
          ref={inputRef}
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the table…"
          aria-label="Chat message"
          className="h-9 bg-background text-sm"
        />
        <Button
          type="submit"
          variant="danfo"
          size="sm"
          disabled={sending || !cleanChatText(draft)}
          aria-label="Send chat message"
        >
          <Send className="size-3.5" />
          <span className="sr-only sm:not-sr-only">Send</span>
        </Button>
      </form>
    </section>
  );
}
