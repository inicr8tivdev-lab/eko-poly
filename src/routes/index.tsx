import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GameScreen } from "@/components/game/GameScreen";
import { Setup } from "@/components/game/Setup";
import { createGame, type GameState } from "@/game/engine";
import { safeClearSavedGame, safeLoadSavedGame, safeSaveGame } from "@/lib/save-game";

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
      { property: "og:url", content: "https://eko-poly.vercel.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://eko-poly.vercel.app/" }],
  }),
  component: Index,
});

function Index() {
  const [game, setGameState] = useState<GameState | null>(null);
  const [saved, setSaved] = useState<GameState | null>(null);

  useEffect(() => {
    setSaved(safeLoadSavedGame(SAVE_KEY));
  }, []);

  useEffect(() => {
    if (game) safeSaveGame(SAVE_KEY, game);
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
        onResume={() => {
          if (saved) setGameState(saved);
        }}
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
        safeClearSavedGame(SAVE_KEY);
        setSaved(null);
        setGameState(null);
      }}
    />
  );
}
