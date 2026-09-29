"use client";

import { Button } from "@/components/Button";

/** Kept beside the board, including after the result message is dismissed. */
export function CompletedGameActions({ gameId, saveFailed = false }: { gameId?: string | null; saveFailed?: boolean }) {
  return <div className="mt-4 space-y-2">
    {gameId ? (
      <Button className="w-full" href={`/student/play/game/${encodeURIComponent(gameId)}/analysis`}>Analyze game</Button>
    ) : (
      <>
        <Button className="w-full" disabled>{saveFailed ? "Analysis unavailable" : "Saving game…"}</Button>
        <p className="text-xs text-slate-300" role="status">{saveFailed ? "This game could not be saved to your history. See the game status below." : "Your analysis board will be ready once this game is saved."}</p>
      </>
    )}
    <Button className="w-full" variant="ghost" href="/student/play/history">Game History</Button>
  </div>;
}
