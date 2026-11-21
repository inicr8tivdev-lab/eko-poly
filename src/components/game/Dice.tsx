import { cn } from "@/lib/utils";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ value, rolling }: { value: number; rolling?: boolean }) {
  return (
    <div
      className={cn(
        "grid size-[clamp(30px,6cqw,56px)] grid-cols-3 grid-rows-3 gap-[8%] rounded-[22%] bg-board p-[14%] shadow-pop",
        rolling && "animate-dice",
      )}
      aria-label={`Die showing ${value}`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={cn("rounded-full", PIPS[value]?.includes(i) ? "bg-board-line" : "bg-transparent")}
        />
      ))}
    </div>
  );
}
