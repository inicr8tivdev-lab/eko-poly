import type { ColorGroup } from "@/game/board";

export const GROUP_BG: Record<ColorGroup, string> = {
  brown: "bg-group-brown",
  lightblue: "bg-group-lightblue",
  pink: "bg-group-pink",
  orange: "bg-group-orange",
  red: "bg-group-red",
  yellow: "bg-group-yellow",
  green: "bg-group-green",
  darkblue: "bg-group-darkblue",
};

export const PLAYER_BG = ["bg-player-1", "bg-player-2", "bg-player-3", "bg-player-4"];
export const PLAYER_TEXT = ["text-player-1", "text-player-2", "text-player-3", "text-player-4"];
export const PLAYER_RING = ["ring-player-1", "ring-player-2", "ring-player-3", "ring-player-4"];
export const PLAYER_BORDER = [
  "border-player-1",
  "border-player-2",
  "border-player-3",
  "border-player-4",
];
