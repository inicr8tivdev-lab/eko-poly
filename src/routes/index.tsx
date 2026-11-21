import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { Setup } from "@/components/game/Setup";
import { createGame, type GameState } from "@/game/engine";

const SAVE_KEY = "ekopoly-save-v2";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ekopoly — The Lagos Property Game" },
      {
        name: "description",
        content:
          "A Monopoly-style board game inspired by Lagos life. Buy Banana Island, ride danfo, survive go-slow and dodge LASTMA.",
      },
      { property: "og:title", content: "Ekopoly — The Lagos Property Game" },
      {
        property: "og:description",
        content: "Buy Lekki, survive go-slow, dodge LASTMA and become the Big Man of Eko.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [game, setGameState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GameState;
        if (parsed.phase !== "gameover") setSaved(parsed);
      }
    } catch {
      localStorage.removeItem(SAVE_KEY);
    }
  }, []);

  useEffect(() => {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  }, [game]);

  const setGame = useCallback((fn: (g: GameState) => GameState) => {
    setGameState((g) => (g ? fn(g) : g));
  }, []);

  const backToSetup = () => {
    setSaved(game && game.phase !== "gameover" ? game : null);
    setGameState(null);
  };

  if (!game) {
    return (
      <Setup
        saved={saved}
        onResume={() => setGameState(saved)}
        onStart={(players, rounds) => setGameState(createGame(players, Math.random, rounds))}
      />
    );
  }

  return (
    <GameScreen
      game={game}
      setGame={setGame}
      onQuit={backToSetup}
      onNewGame={() => {
        localStorage.removeItem(SAVE_KEY);
        setSaved(null);
        setGameState(null);
      }}
    />
  );
}
