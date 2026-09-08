import type { ChessColor, TimeControl } from "@/chess/types";

export function berserkInitialMs(control: TimeControl): number | null {
  if (!control.initialMs || control.initialMs <= 0) return null;
  // Lichess's 1+2 exception: remove the increment but keep the full minute.
  return control.initialMs === 60_000 && control.incrementMs === 2_000
    ? 60_000 : Math.floor(control.initialMs / 2);
}

export function canBerserk(game: {
  status: string; arenaTournamentId: string | null; timeControl: TimeControl;
  moves: { color: ChessColor }[]; berserk?: Partial<Record<ChessColor, boolean>>;
}, color: ChessColor) {
  return game.status === "active" && Boolean(game.arenaTournamentId)
    && berserkInitialMs(game.timeControl) !== null && !game.berserk?.[color]
    && !game.moves.some((move) => move.color === color);
}
