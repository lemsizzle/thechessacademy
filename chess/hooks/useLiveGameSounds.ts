"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChessSounds } from "@/chess/hooks/useChessSounds";
import { captureSquareForUpdate, liveGameSoundForUpdate, type LiveGameSoundSnapshot } from "@/chess/live/liveGameSounds";

const LIVE_GAME_SOUND_PREFERENCE_KEY = "chess-academy-live-game-sounds";

export function useLiveGameSounds() {
  const snapshotRef = useRef<LiveGameSoundSnapshot | null>(null);
  const captureEffectIdRef = useRef(0);
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [captureEffect, setCaptureEffect] = useState<{ id: number; square: string } | null>(null);
  const { muted, setMuted, play, prepare } = useChessSounds(true);

  useEffect(() => {
    setMuted(window.localStorage.getItem(LIVE_GAME_SOUND_PREFERENCE_KEY) !== "on");
  }, [setMuted]);

  useEffect(() => {
    if (muted) return;
    const unlockAudio = () => prepare();
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [muted, prepare]);

  useEffect(() => () => {
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
  }, []);

  const receiveGameSnapshot = useCallback((next: LiveGameSoundSnapshot) => {
    const previous = snapshotRef.current;
    const sound = liveGameSoundForUpdate(previous, next);
    const captureSquare = captureSquareForUpdate(previous, next);
    snapshotRef.current = next;
    if (sound) play(sound);
    if (captureSquare) {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
      captureEffectIdRef.current += 1;
      setCaptureEffect({ id: captureEffectIdRef.current, square: captureSquare });
      captureTimerRef.current = setTimeout(() => setCaptureEffect(null), 800);
    }
  }, [play]);

  const toggleMuted = useCallback(() => {
    const next = !muted;
    window.localStorage.setItem(LIVE_GAME_SOUND_PREFERENCE_KEY, next ? "off" : "on");
    if (!next) prepare();
    setMuted(next);
  }, [muted, prepare, setMuted]);

  return { muted, toggleMuted, receiveGameSnapshot, captureEffect };
}
