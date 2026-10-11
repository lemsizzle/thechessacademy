"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";

const EnterZenContext = createContext<(() => void) | null>(null);

export function ZenModeButton() {
  const enterZen = useContext(EnterZenContext);
  return enterZen ? <Button type="button" variant="ghost" onClick={enterZen} aria-keyshortcuts="Z" title="Focus on the board and clocks (Z)">Zen mode</Button> : null;
}

function isEditing(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}

function hasOpenDialog() {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"]')).some(element => element.getClientRects().length > 0);
}

/** One mounted board and one set of players; CSS reflows the controls around them. */
export function GameBoardWorkspace({ title, settings, opponent, player, board, children, revealOnMount = false, revealResult = false, attentionRequired = false, onEnterZen }: {
  title: string;
  settings: ReactNode;
  opponent: ReactNode;
  player: ReactNode;
  board: ReactNode;
  children: ReactNode;
  revealOnMount?: boolean;
  revealResult?: boolean;
  attentionRequired?: boolean;
  onEnterZen?: () => void;
}) {
  const workspace = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const entryPosition = useRef<{ focus: HTMLElement | null; left: number; top: number; controlsTop: number } | null>(null);
  const [isZen, setZen] = useState(false);
  const enterZen = useCallback(() => {
    if (hasOpenDialog()) return;
    // Capture before fixed positioning can change the document's scroll range.
    entryPosition.current = {
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      left: window.scrollX, top: window.scrollY, controlsTop: controls.current?.scrollTop ?? 0,
    };
    onEnterZen?.();
    setZen(true);
  }, [onEnterZen]);
  const leaveZen = useCallback(() => { restoreFocus.current = true; setZen(false); }, []);

  useEffect(() => {
    const root = workspace.current;
    if (!isZen || !root) return;
    const previous = entryPosition.current;
    restoreFocus.current = false;
    // Isolate the existing workspace without moving/remounting the game.
    // New promotion/confirmation dialogs remain usable outside this subtree.
    const background: Array<{ element: HTMLElement; inert: boolean }> = [];
    let branch: HTMLElement = root;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    exitButton.current?.focus({ preventScroll: true });
    function keepFocusInGame(event: FocusEvent) {
      // Background notices can mount after entry; dialogs such as promotion
      // still need to receive focus outside the workspace.
      if (event.target instanceof Node && !root?.contains(event.target) && !hasOpenDialog()) {
        exitButton.current?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("focusin", keepFocusInGame);
    return () => {
      document.removeEventListener("focusin", keepFocusInGame);
      for (const item of background) item.element.inert = item.inert;
      // A route change or game result should not jump back to an old control.
      if (restoreFocus.current && root.isConnected && previous) {
        controls.current?.scrollTo({ top: previous.controlsTop, behavior: "instant" });
        window.scrollTo({ left: previous.left, top: previous.top, behavior: "instant" });
        if (previous.focus?.isConnected) previous.focus.focus({ preventScroll: true });
      }
    };
  }, [isZen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || hasOpenDialog()) return;
      if (event.key === "Escape" && isZen) {
        leaveZen();
        // Let the board also clear a selected square or premove on Escape.
      } else if (event.key.toLowerCase() === "z" && !isEditing(event.target)) {
        event.preventDefault();
        if (isZen) leaveZen(); else enterZen();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enterZen, isZen, leaveZen]);
  useEffect(() => {
    if (!revealOnMount) return;
    // Starting from the bottom of the bot chooser should reveal the new board.
    // This runs once, never on a clock tick or a resize.
    const frame = requestAnimationFrame(() => workspace.current?.scrollIntoView({ block: "start", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [revealOnMount]);
  useEffect(() => {
    if (revealResult || attentionRequired) setZen(false);
  }, [revealResult, attentionRequired]);
  useEffect(() => {
    // A result must be visible even if the player was reading moves or chat.
    // Wait for the Zen controls to be visible, then scroll only this panel.
    if ((revealResult || attentionRequired) && !isZen) {
      controls.current?.scrollTo({ top: 0, behavior: "instant" });
      if (attentionRequired) {
        controls.current?.querySelector<HTMLElement>("[data-game-attention]")?.scrollIntoView({ block: "nearest", behavior: "instant" });
      }
    }
  }, [revealResult, attentionRequired, isZen]);

  return (
    <EnterZenContext.Provider value={enterZen}>
      <div ref={workspace} className="game-workspace" data-board-fit-screen data-zen={isZen ? "true" : undefined}>
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
            <div className="game-zen-exit">
              <button ref={exitButton} type="button" onClick={leaveZen} aria-keyshortcuts="Escape Z" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
                <span aria-hidden="true">×</span> Exit Zen
              </button>
              <span className="game-zen-shortcut text-xs text-slate-400">Esc or Z</span>
            </div>
            <aside ref={controls} className="game-sidebar" aria-label="Game information and controls" tabIndex={0}>{children}</aside>
          </div>
        </div>
      </div>
    </EnterZenContext.Provider>
  );
}
