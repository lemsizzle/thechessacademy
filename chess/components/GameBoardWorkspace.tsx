"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** One mounted board and one set of players; CSS reflows the controls around them. */
export function GameBoardWorkspace({ title, settings, opponent, player, board, children, revealOnMount = false, revealResult = false }: {
  title: string;
  settings: ReactNode;
  opponent: ReactNode;
  player: ReactNode;
  board: ReactNode;
  children: ReactNode;
  revealOnMount?: boolean;
  revealResult?: boolean;
}) {
  const workspace = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!revealOnMount) return;
    // Starting from the bottom of the bot chooser should reveal the new board.
    // This runs once, never on a clock tick or a resize.
    const frame = requestAnimationFrame(() => workspace.current?.scrollIntoView({ block: "start", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [revealOnMount]);
  useEffect(() => {
    // A result must be visible even if the player was reading moves or chat.
    // Scroll only this panel so the final board and both clocks stay in place.
    if (revealResult) controls.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [revealResult]);

  return (
    <div ref={workspace} className="game-workspace" data-board-fit-screen>
      <div className="game-layout">
        <section className="game-board-column" aria-label="Chessboard">
          <div className="game-board-toolbar">
            <h2 className="truncate text-sm font-black text-cyan-100">{title}</h2>
            {settings}
          </div>
          {board}
        </section>
        <div className="game-information">
          <div className="game-opponent">{opponent}</div>
          <div className="game-player">{player}</div>
          <aside ref={controls} className="game-sidebar" aria-label="Game information and controls" tabIndex={0}>{children}</aside>
        </div>
      </div>
    </div>
  );
}
