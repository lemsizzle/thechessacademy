"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { getDefaultEquippedItems, seedAvatarItems } from "@/lib/avatar/catalog";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";
import styles from "./MatchIntro.module.css";

type Contestant = { name: string; avatar?: StudentAvatarConfig; portrait?: string };
type MatchIntroProps = {
  matchId: string;
  eligible: boolean;
  player: Contestant;
  opponent: Contestant;
  avatarItems: AvatarItem[];
};

const storageKey = "academy.match-intros.v1";
const seen = new Set<string>();

function claimIntroduction(id: string) {
  if (seen.has(id)) return false;
  let saved: string[] = [];
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(value)) saved = value.filter((entry): entry is string => typeof entry === "string").slice(-40);
  } catch { /* Restricted or full storage must never prevent play. */ }
  const fresh = !saved.includes(id);
  seen.add(id);
  if (seen.size > 40) seen.delete(seen.values().next().value!);
  if (fresh) {
    try { sessionStorage.setItem(storageKey, JSON.stringify([...saved, id].slice(-40))); } catch { /* In-memory fallback. */ }
  }
  return fresh;
}

/** Cosmetic only: never delays clocks, engine startup, or board input. */
export function MatchIntro({ matchId, eligible, player, opponent, avatarItems }: MatchIntroProps) {
  const [visible, setVisible] = useState(false);
  const attempt = useRef<{ id: string; show: boolean } | null>(null);

  useEffect(() => {
    if (!eligible || !matchId) {
      if (attempt.current?.id === matchId) attempt.current.show = false;
      setVisible(false);
      return;
    }
    if (attempt.current?.id !== matchId) attempt.current = { id: matchId, show: claimIntroduction(matchId) };
    if (!attempt.current.show) return;
    setVisible(true);
    const dismiss = () => { attempt.current = { id: matchId, show: false }; setVisible(false); };
    const timer = window.setTimeout(dismiss, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1200 : 2100);
    // Let the same tap continue through to the board or controls underneath.
    window.addEventListener("pointerdown", dismiss, { capture: true, passive: true });
    window.addEventListener("keydown", dismiss, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", dismiss, true);
    };
  }, [matchId, eligible]);

  if (!visible || !eligible) return null;
  return (
    <div className={styles.intro} data-match-intro role="status" aria-label={`${player.name} versus ${opponent.name}. Good luck!`}>
      <div className={styles.banner} aria-hidden="true">
        <p className={styles.eyebrow}>Let’s play</p>
        <div className={styles.matchup}>
          {[player, opponent].map((contestant, index) => (
            <div key={index} className={`${styles.contestant} ${index ? styles.opponent : styles.player}`}>
              <div className={styles.portrait}>
                {contestant.avatar ? <AvatarRenderer avatar={contestant.avatar} items={avatarItems} size="lg" label={`${contestant.name}'s avatar`} />
                  : contestant.portrait ? <img src={contestant.portrait} alt="" width={160} height={160} />
                  : <AvatarRenderer avatar={{ studentId: matchId + index, equippedItems: getDefaultEquippedItems(seedAvatarItems) }} items={avatarItems} size="lg" />}
              </div>
              <p className={styles.name}>{contestant.name}</p>
            </div>
          ))}
          <span className={styles.versus}>VS</span>
        </div>
        <p className={styles.hint}>Your next great move starts here · Tap to play</p>
      </div>
    </div>
  );
}
