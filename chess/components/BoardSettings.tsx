"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { useBoardAppearance } from "@/chess/appearance/BoardAppearanceProvider";
import { purchasedChessThemes, PURCHASABLE_CHESS_THEMES, type ChessTheme } from "@/chess/appearance/themes";

/** Shared gear menu. Sound controls are optional on silent exercise boards. */
export function BoardSettings({ muted, onToggleMuted }: { muted?: boolean; onToggleMuted?: () => void } = {}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const settingsId = useId();
  const { appearance, ownedThemes, loading, setAppearance } = useBoardAppearance();
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setPosition(null); trigger.current?.focus({ preventScroll: true }); }
    };
    const closeOnResize = () => setPosition(null);
    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnResize);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [open]);

  return (
    <div className="relative flex justify-end" data-board-settings>
      <button
        ref={trigger} type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-slate-950/90 text-lg text-slate-200 shadow-lg hover:border-cyan-200/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        aria-label="Board settings" aria-expanded={open} aria-controls={open ? settingsId : undefined} aria-haspopup="dialog"
        onClick={() => {
          if (open) { setPosition(null); return; }
          const rect = trigger.current?.getBoundingClientRect();
          if (!rect) return;
          setPosition({ left: Math.max(8, Math.min(rect.right - 288, window.innerWidth - 296)), top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 370)) });
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m9 3-.7 2.5-2 .9L4 5.7 2.5 8.3l1.8 1.8-.1 2.3L2.5 14 4 16.7l2.5-.6 1.8 1.1L9 20h3l.8-2.7 1.9-1.1 2.4.6 1.5-2.6-1.7-1.7v-2.3l1.7-1.8-1.5-2.6-2.3.7-2-.9L12 3Z" transform="translate(1.5 .5)" /><circle cx="12" cy="12" r="3.3" /></svg>
      </button>
      {position ? createPortal(
        <div ref={panel} id={settingsId} tabIndex={-1} data-board-settings role="dialog" aria-label="Board settings" className="fixed z-[100] w-72 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-white/20 bg-slate-950 p-4 text-left text-sm text-white shadow-2xl outline-none" style={{ ...position, maxHeight: "calc(100dvh - 16px)" }} onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") { setPosition(null); trigger.current?.focus({ preventScroll: true }); }
          if (event.key === "Tab") {
            const targets = panel.current?.querySelectorAll<HTMLElement>("button,select,a[href]");
            const first = targets?.[0]; const last = targets?.[targets.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-black">Board settings</h2><button type="button" aria-label="Close board settings" className="rounded px-2 py-1 text-slate-300 hover:bg-white/10" onClick={() => { setPosition(null); trigger.current?.focus({ preventScroll: true }); }}>✕</button></div>
          {(["boardTheme", "pieceTheme"] as const).map((field) => (
            <label key={field} className="mb-3 grid gap-1.5 text-xs font-bold text-slate-300">
              {field === "boardTheme" ? "Board theme" : "Piece theme"}
              <select aria-label={field === "boardTheme" ? "Board theme" : "Piece theme"} className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white focus-visible:outline-cyan-200" value={appearance[field]} onChange={(event) => setAppearance({ ...appearance, [field]: event.target.value as ChessTheme })}>
                <option value="academy">Academy · free</option>
                {purchasedChessThemes.map((theme) => <option key={theme} value={theme} disabled={!ownedThemes.includes(theme)}>{PURCHASABLE_CHESS_THEMES[theme].label}{ownedThemes.includes(theme) ? "" : " · locked"}</option>)}
              </select>
            </label>
          ))}
          {ownedThemes.length < purchasedChessThemes.length ? <p className="mb-3 text-xs leading-5 text-amber-100">{loading ? "Checking your chess sets…" : <>Unlock more boards and pieces in the <Link href="/student/avatar?category=board_theme" className="font-bold underline underline-offset-2">Avatar Store</Link>.</>}</p> : null}
          <p className="text-xs leading-5 text-slate-400">Your choices apply to games and training on this browser.</p>
          {onToggleMuted ? <button type="button" className="mt-3 flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 font-bold hover:bg-white/10" aria-pressed={!muted} onClick={onToggleMuted}><span>{muted ? "Sounds muted" : "Sounds on"}</span><span aria-hidden="true">{muted ? "🔇" : "🔊"}</span></button> : null}
        </div>, document.body
      ) : null}
    </div>
  );
}
