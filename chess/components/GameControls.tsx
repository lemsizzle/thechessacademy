"use client";

import { Button } from "@/components/Button";
import { ZenModeButton } from "@/chess/components/GameBoardWorkspace";

export function GameControls({ canTakeBack, muted, onResign, onTakeBack, onFlip, onNewGame, onToggleMute }: {
  canTakeBack: boolean;
  muted: boolean;
  onResign: () => void;
  onTakeBack: () => void;
  onFlip: () => void;
  onNewGame: () => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="ghost" onClick={onTakeBack} disabled={!canTakeBack}>↶ Take Back</Button>
      <Button type="button" variant="ghost" onClick={onFlip}>⇅ Flip Board</Button>
      <Button type="button" variant="ghost" onClick={onToggleMute}>{muted ? "🔇 Sound Off" : "🔊 Sound On"}</Button>
      <Button type="button" variant="ghost" onClick={onNewGame}>＋ New Game</Button>
      <ZenModeButton />
      <Button type="button" variant="ghost" onClick={onResign} className="border-rose-300/25 text-rose-100">⚑ Resign</Button>
    </div>
  );
}
