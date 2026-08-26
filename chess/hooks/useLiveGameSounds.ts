"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChessSounds } from "@/chess/hooks/useChessSounds";
import { liveGameSoundForUpdate, type LiveGameSoundSnapshot } from "@/chess/live/liveGameSounds";

const LIVE_GAME_SOUND_PREFERENCE_KEY = "chess-academy-live-game-sounds";

export function useLiveGameSounds() {
  const snapshotRef = useRef<LiveGameSoundSnapshot | null>(null);
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

  const receiveSoundSnapshot = useCallback((next: LiveGameSoundSnapshot) => {
    const sound = liveGameSoundForUpdate(snapshotRef.current, next);
    snapshotRef.current = next;
    if (sound) play(sound);
  }, [play]);

  const toggleMuted = useCallback(() => {
    const next = !muted;
    window.localStorage.setItem(LIVE_GAME_SOUND_PREFERENCE_KEY, next ? "off" : "on");
    if (!next) prepare();
    setMuted(next);
  }, [muted, prepare, setMuted]);

  return { muted, toggleMuted, receiveSoundSnapshot };
}
