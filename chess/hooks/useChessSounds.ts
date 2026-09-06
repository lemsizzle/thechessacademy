"use client";

import { useCallback, useRef, useState } from "react";

export type ChessSound = "move" | "capture" | "check" | "warning" | "end" | "explosion" | "victory";

const woodNoiseBuffers = new WeakMap<AudioContext, AudioBuffer>();

function getWoodNoiseBuffer(context: AudioContext) {
  const existing = woodNoiseBuffers.get(context);
  if (existing) return existing;

  const durationSeconds = 0.08;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * durationSeconds), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let smoothedNoise = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const whiteNoise = Math.random() * 2 - 1;
    smoothedNoise = smoothedNoise * 0.42 + whiteNoise * 0.58;
    const envelope = Math.exp(-index / (context.sampleRate * 0.012));
    samples[index] = smoothedNoise * envelope;
  }

  woodNoiseBuffers.set(context, buffer);
  return buffer;
}

function playWoodImpact(
  context: AudioContext,
  startsAt: number,
  volume: number,
  resonanceFrequency: number
) {
  const clack = context.createBufferSource();
  const clackFilter = context.createBiquadFilter();
  const clackGain = context.createGain();
  clack.buffer = getWoodNoiseBuffer(context);
  clack.playbackRate.setValueAtTime(0.94 + Math.random() * 0.12, startsAt);
  clackFilter.type = "bandpass";
  clackFilter.frequency.setValueAtTime(resonanceFrequency * 4.5, startsAt);
  clackFilter.Q.setValueAtTime(0.75, startsAt);
  clackGain.gain.setValueAtTime(volume, startsAt);
  clackGain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.055);
  clack.connect(clackFilter);
  clackFilter.connect(clackGain);
  clackGain.connect(context.destination);
  clack.start(startsAt);
  clack.stop(startsAt + 0.08);

  const body = context.createOscillator();
  const bodyFilter = context.createBiquadFilter();
  const bodyGain = context.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(resonanceFrequency * 1.12, startsAt);
  body.frequency.exponentialRampToValueAtTime(resonanceFrequency, startsAt + 0.055);
  bodyFilter.type = "lowpass";
  bodyFilter.frequency.setValueAtTime(520, startsAt);
  bodyGain.gain.setValueAtTime(volume * 0.4, startsAt);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.085);
  body.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(context.destination);
  body.start(startsAt);
  body.stop(startsAt + 0.09);
}

function playWoodenPieceSound(context: AudioContext, sound: "move" | "capture" | "check") {
  const startsAt = context.currentTime;

  if (sound === "capture") {
    playWoodImpact(context, startsAt, 0.095, 165);
    playWoodImpact(context, startsAt + 0.045, 0.11, 145);
    return;
  }

  playWoodImpact(context, startsAt, sound === "check" ? 0.11 : 0.1, sound === "check" ? 185 : 155);
  if (sound === "check") playWoodImpact(context, startsAt + 0.055, 0.045, 240);
}

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

function playClockWarning(context: AudioContext) {
  for (const [index, frequency] of [880, 660].entries()) {
    const startsAt = context.currentTime + index * 0.16;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "triangle";
    gain.gain.setValueAtTime(0.001, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.09, startsAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + 0.2);
  }
}

function playExplosionSound(context: AudioContext) {
  const startsAt = context.currentTime;
  const durationSeconds = 0.7;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * durationSeconds), context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let index = 0; index < samples.length; index += 1) {
    const progress = index / samples.length;
    const envelope = Math.exp(-progress * 7.5);
    samples[index] = (Math.random() * 2 - 1) * envelope;
  }

  const burst = context.createBufferSource();
  const burstFilter = context.createBiquadFilter();
  const burstGain = context.createGain();
  burst.buffer = buffer;
  burstFilter.type = "lowpass";
  burstFilter.frequency.setValueAtTime(1_100, startsAt);
  burstFilter.frequency.exponentialRampToValueAtTime(120, startsAt + 0.58);
  burstGain.gain.setValueAtTime(0.18, startsAt);
  burstGain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.65);
  burst.connect(burstFilter);
  burstFilter.connect(burstGain);
  burstGain.connect(context.destination);
  burst.start(startsAt);
  burst.stop(startsAt + durationSeconds);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(105, startsAt);
  thump.frequency.exponentialRampToValueAtTime(38, startsAt + 0.42);
  thumpGain.gain.setValueAtTime(0.16, startsAt);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.46);
  thump.connect(thumpGain);
  thumpGain.connect(context.destination);
  thump.start(startsAt);
  thump.stop(startsAt + 0.48);
}

function playVictoryFanfare(context: AudioContext) {
  const notes = [392, 523.25, 659.25, 783.99];
  for (const [index, frequency] of notes.entries()) {
    const startsAt = context.currentTime + index * 0.13;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index === notes.length - 1 ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(frequency, startsAt);
    gain.gain.setValueAtTime(0.001, startsAt);
    gain.gain.exponentialRampToValueAtTime(index === notes.length - 1 ? 0.07 : 0.045, startsAt + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, startsAt + (index === notes.length - 1 ? 0.48 : 0.23));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + (index === notes.length - 1 ? 0.5 : 0.25));
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
      if (sound === "warning") {
        playClockWarning(context);
        return;
      }
      if (sound === "explosion") {
        playExplosionSound(context);
        return;
      }
      if (sound === "victory") {
        playVictoryFanfare(context);
        return;
      }
      playWoodenPieceSound(context, sound);
    } catch {
      // Audio is an enhancement; browser autoplay/device failures never block play.
    }
  }, [muted]);

  return { muted, setMuted, play, prepare };
}
