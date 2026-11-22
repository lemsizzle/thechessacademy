"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./GameEndAnimation.module.css";

type Result = "win" | "loss" | "draw";
const copy = {
  win: { title: "Victory!", message: "A brilliant finish. Enjoy your moment!", symbol: "♔" },
  loss: { title: "Keep your head up", message: "One game, one new lesson. Your next move awaits.", symbol: "♞" },
  draw: { title: "Honors shared!", message: "A hard-fought draw. Well played, both sides.", symbol: "½" }
};

/** A nonmodal result flourish. Dismissing it never dismisses the game actions. */
export function GameEndAnimation({ result }: { result: Result }) {
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
    // Only scroll if the result is below the viewport; never cover or resize
    // the board. The desktop controls rail scrolls independently of the board.
    const frame = requestAnimationFrame(() => {
      const element = panel.current;
      if (!element) return;
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Primary student navigation"]');
      const navRect = nav?.getBoundingClientRect();
      const bottom = navRect && navRect.height > 0 && navRect.top > 0 ? Math.min(innerHeight, navRect.top) : innerHeight;
      if (element.getBoundingClientRect().bottom > bottom) {
        element.scrollIntoView({ block: "nearest", behavior: "instant" });
        const overlap = element.getBoundingClientRect().bottom - bottom;
        if (overlap > 0) window.scrollBy({ top: overlap + 8, behavior: "instant" });
      }
    });
    window.addEventListener("pointerdown", outside, { capture: true, passive: true });
    window.addEventListener("keydown", keyboard);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("keydown", keyboard);
    };
  }, [visible]);

  if (!visible) return null;
  const content = copy[result];
  return (
    <section ref={panel} className={`${styles.popup} ${styles[result]}`} data-game-end-animation={result} aria-label="Game ending animation">
      <div className={styles.particles} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}
      </div>
      <button type="button" className={styles.close} onClick={() => setVisible(false)} aria-label="Dismiss game ending animation">×</button>
      <div className={styles.medal} aria-hidden="true">{content.symbol}</div>
      <div className={styles.copy} role="status">
        <h2>{content.title}</h2>
        <p>{content.message}</p>
      </div>
      <p className={styles.skip}>Click or tap outside to skip</p>
      <div className={styles.progress} aria-hidden="true" />
    </section>
  );
}
