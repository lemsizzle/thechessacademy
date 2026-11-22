"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { getDefaultEquippedItems, seedAvatarItems } from "@/lib/avatar/catalog";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";
import styles from "./GameEndAnimation.module.css";

type Result = "win" | "loss" | "draw";
type Contestant = { name: string; avatar?: StudentAvatarConfig; portrait?: string };
const copy = {
  win: { title: "Victory!", message: "A brilliant finish. Enjoy your moment!", symbol: "♔" },
  loss: { title: "Keep your head up", message: "One game, one new lesson. Your next move awaits.", symbol: "♞" },
  draw: { title: "Honors shared!", message: "A hard-fought draw. Well played, both sides.", symbol: "½" }
};

/** A nonmodal result flourish. Dismissing it never dismisses the game actions. */
export function GameEndAnimation({ result, player, opponent, avatarItems }: { result: Result; player: Contestant; opponent: Contestant; avatarItems: AvatarItem[] }) {
  const [visible, setVisible] = useState(true);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!visible) return;
    const dismiss = () => setVisible(false);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) dismiss();
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    const timer = window.setTimeout(dismiss, 10_000);
    window.addEventListener("pointerdown", outside, { capture: true, passive: true });
    window.addEventListener("keydown", keyboard);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", keyboard);
    };
  }, [visible]);

  if (!visible) return null;
  const content = copy[result];
  return (
    <div className={styles.overlay}>
    <section ref={panel} className={`${styles.popup} ${styles[result]}`} data-game-end-animation={result} aria-label="Game ending animation">
      <div className={styles.particles} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}
      </div>
      <button type="button" className={styles.close} onClick={() => setVisible(false)} aria-label="Dismiss game ending animation">×</button>
      <div className={styles.copy} role="status">
        <h2>{content.title}</h2>
        <p>{result === "draw" ? "A game well played by both sides" : `${result === "win" ? player.name : opponent.name} wins`}</p>
      </div>
      <div className={styles.matchup}>
        {[player, opponent].map((contestant, index) => {
          const winner = result !== "draw" && (result === "win" ? index === 0 : index === 1);
          return <div key={index} className={`${styles.contestant} ${winner ? styles.winner : ""}`} data-result-contestant={index === 0 ? "player" : "opponent"} data-winner={winner || undefined}>
            <div className={styles.portrait}>
              {contestant.avatar ? <AvatarRenderer avatar={contestant.avatar} items={avatarItems} size="lg" label={`${contestant.name}'s avatar`} />
                : contestant.portrait ? <img src={contestant.portrait} alt={`${contestant.name}'s avatar`} width={160} height={160} />
                : <AvatarRenderer avatar={{ studentId: `result-${index}`, equippedItems: getDefaultEquippedItems(seedAvatarItems) }} items={avatarItems} size="lg" label={`${contestant.name}'s avatar`} />}
            </div>
            <p className={styles.name}>{contestant.name}</p>
            <span className={styles.playerResult}>{result === "draw" ? "½ – ½" : winner ? "Winner" : "Well played"}</span>
          </div>;
        })}
        <span className={styles.medal} aria-hidden="true">{content.symbol}</span>
      </div>
      <p className={styles.message}>{content.message}</p>
      <p className={styles.skip}>Click or tap outside to skip</p>
      <div className={styles.progress} aria-hidden="true" />
    </section>
    </div>
  );
}
