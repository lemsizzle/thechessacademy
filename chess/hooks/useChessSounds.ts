"use client";

import { useCallback, useRef, useState } from "react";

export type ChessSound = "move" | "capture" | "check" | "end";

const soundFrequency: Record<ChessSound, number> = {
  move: 330,
  capture: 220,
  check: 520,
  end: 660
};

function playGameEndCadence(context: AudioContext) {
  const notes = [392, 523.25, 659.25];
  for (const [index, frequency] of notes.entries()) {
    const startsAt = context.currentTime + index * 0.11;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = index === notes.length - 1 ? "triangle" : "sine";
    gain.gain.setValueAtTime(0.001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.055, startsAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.24);
  }
}

export function useChessSounds(initialMuted = false) {
  const [muted, setMuted] = useState(initialMuted);
  const contextRef = useRef<AudioContext | null>(null);

  const prepare = useCallback(() => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    try {
      contextRef.current ??= new AudioContext();
      if (contextRef.current.state === "suspended") void contextRef.current.resume();
    } catch {
      // Sound must never block a chess interaction.
    }
  }, []);

  const play = useCallback((sound: ChessSound) => {
    if (muted || typeof window === "undefined" || !("AudioContext" in window)) return;
    try {
      contextRef.current ??= new AudioContext();
      const context = contextRef.current;
      if (context.state === "suspended") void context.resume();
      if (sound === "end") {
        playGameEndCadence(context);
        return;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = soundFrequency[sound];
      oscillator.type = sound === "capture" ? "square" : "sine";
      gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.14);
    } catch {
      // Audio is an enhancement; browser autoplay/device failures never block play.
    }
  }, [muted]);

  return { muted, setMuted, play, prepare };
}
