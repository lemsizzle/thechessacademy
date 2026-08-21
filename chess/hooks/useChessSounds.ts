"use client";

import { useCallback, useRef, useState } from "react";

export type ChessSound = "move" | "capture" | "check" | "end";

const soundFrequency: Record<ChessSound, number> = {
  move: 330,
  capture: 220,
  check: 520,
  end: 660
};

export function useChessSounds() {
  const [muted, setMuted] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

  const play = useCallback((sound: ChessSound) => {
    if (muted || typeof window === "undefined" || !("AudioContext" in window)) return;
    try {
      contextRef.current ??= new AudioContext();
      const context = contextRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = soundFrequency[sound];
      oscillator.type = sound === "capture" ? "square" : "sine";
      gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (sound === "end" ? 0.28 : 0.12));
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (sound === "end" ? 0.3 : 0.14));
    } catch {
      // Audio is an enhancement; browser autoplay/device failures never block play.
    }
  }, [muted]);

  return { muted, setMuted, play };
}
