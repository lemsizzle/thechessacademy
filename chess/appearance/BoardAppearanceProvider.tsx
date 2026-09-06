"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultPieces } from "react-chessboard";
import { paperPieces } from "./PaperPieces";
import { blossomPieces } from "./BlossomPieces";
import { eightBitPieces } from "./EightBitPieces";
import { appearanceStorageKey, BOARD_THEME_STYLES, DEFAULT_BOARD_APPEARANCE, parseBoardAppearance, parseOwnedChessThemes, unlockedAppearance, type BoardAppearance, type PurchasedChessTheme } from "./themes";

type AppearanceContext = {
  appearance: BoardAppearance;
  ownedThemes: readonly PurchasedChessTheme[];
  loading: boolean;
  setAppearance: (next: BoardAppearance) => boolean;
  refreshOwnership: (force?: boolean) => Promise<readonly PurchasedChessTheme[]>;
};
const NO_OWNED_THEMES: readonly PurchasedChessTheme[] = [];
const themePieces = { academy: defaultPieces, paper: paperPieces, blossom: blossomPieces, eightBit: eightBitPieces };
const BoardAppearanceContext = createContext<AppearanceContext>({ appearance: DEFAULT_BOARD_APPEARANCE, ownedThemes: NO_OWNED_THEMES, loading: false, setAppearance: () => false, refreshOwnership: async () => NO_OWNED_THEMES });

export function BoardAppearanceProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  // Remount only preferences when the signed-in identity changes, never on theme changes.
  return <StudentBoardAppearance key={studentId} studentId={studentId}>{children}</StudentBoardAppearance>;
}

function StudentBoardAppearance({ studentId, children }: { studentId: string; children: ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_BOARD_APPEARANCE);
  const [ownedThemes, setOwnedThemes] = useState<readonly PurchasedChessTheme[]>(NO_OWNED_THEMES);
  const [loading, setLoading] = useState(true);
  const request = useRef<Promise<readonly PurchasedChessTheme[]> | null>(null);
  const mounted = useRef(false);
  const key = appearanceStorageKey(studentId);
  const refreshOwnership = useCallback(function refresh(force = false): Promise<readonly PurchasedChessTheme[]> {
    // A purchase must recheck after any older in-flight inventory snapshot finishes.
    if (request.current) return force ? request.current.then(() => refresh()) : request.current;
    request.current = fetch("/api/student/board-themes", { cache: "no-store", credentials: "include", signal: AbortSignal.timeout(8000) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to check ownership");
        const data = await response.json() as { studentId?: string; ownsPaper?: boolean; ownedThemes?: unknown };
        // Retain Paper compatibility during a rolling deployment; never infer Blossom ownership.
        const owned = data.studentId === studentId ? parseOwnedChessThemes(data.ownedThemes ?? (data.ownsPaper === true ? ["paper"] : [])) : NO_OWNED_THEMES;
        if (mounted.current) setOwnedThemes(owned);
        return owned;
      })
      .catch(() => { if (mounted.current) setOwnedThemes(NO_OWNED_THEMES); return NO_OWNED_THEMES; })
      .finally(() => { request.current = null; if (mounted.current) setLoading(false); });
    return request.current;
  }, [studentId]);

  useEffect(() => {
    mounted.current = true;
    function readPreferences() {
      try { setPreferences(parseBoardAppearance(window.localStorage.getItem(key))); } catch { /* Storage can be blocked; keep the in-memory choice. */ }
    }
    function onStorage(event: StorageEvent) { if (event.key === key || event.key === null) readPreferences(); }
    function onFocus() { if (document.visibilityState === "visible") void refreshOwnership(); }
    readPreferences();
    void refreshOwnership();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => { mounted.current = false; window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); };
  }, [key, refreshOwnership]);

  const setAppearance = useCallback((next: BoardAppearance) => {
    const valid = parseBoardAppearance(JSON.stringify(next));
    const allowed = unlockedAppearance(valid, ownedThemes);
    if (allowed.boardTheme !== valid.boardTheme || allowed.pieceTheme !== valid.pieceTheme) return false;
    setPreferences(valid);
    try { window.localStorage.setItem(key, JSON.stringify(valid)); } catch { /* Changing appearance still works without browser storage. */ }
    return true;
  }, [key, ownedThemes]);
  const value = useMemo(() => ({ appearance: unlockedAppearance(preferences, ownedThemes), ownedThemes, loading, setAppearance, refreshOwnership }), [preferences, ownedThemes, loading, setAppearance, refreshOwnership]);
  return <BoardAppearanceContext.Provider value={value}>{children}</BoardAppearanceContext.Provider>;
}

export function useBoardAppearance() {
  const context = useContext(BoardAppearanceContext);
  return { ...context, squareStyles: BOARD_THEME_STYLES[context.appearance.boardTheme], pieces: themePieces[context.appearance.pieceTheme] };
}
