import { lichessPuzzleThemes, type LichessPuzzleTheme } from "./types";

export type ImportCandidate = {
  lichess_puzzle_id: string;
  themes: string[];
};

export type ThemeCounts = Record<LichessPuzzleTheme, number>;

export class BoundedIdTracker {
  private readonly bits: Uint8Array;

  constructor(private readonly bitCount = 1 << 27, private readonly hashCount = 4) {
    if (bitCount < 8 || hashCount < 1) throw new Error("Invalid duplicate tracker size.");
    this.bits = new Uint8Array(Math.ceil(bitCount / 8));
  }

  hasAndAdd(value: string) {
    let alreadySeen = true;
    const indexes: number[] = [];
    for (let seed = 0; seed < this.hashCount; seed += 1) {
      let hash = (2166136261 ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0;
      for (let index = 0; index < value.length; index += 1) {
        hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
      }
      const bitIndex = hash % this.bitCount;
      indexes.push(bitIndex);
      if ((this.bits[bitIndex >>> 3] & (1 << (bitIndex & 7))) === 0) alreadySeen = false;
    }
    for (const bitIndex of indexes) this.bits[bitIndex >>> 3] |= 1 << (bitIndex & 7);
    return alreadySeen;
  }
}

export function emptyThemeCounts(): ThemeCounts {
  return { fork: 0, pin: 0, skewer: 0, mateIn1: 0 };
}

export function targetThemesFor(candidate: Pick<ImportCandidate, "themes">) {
  return lichessPuzzleThemes.filter((theme) => candidate.themes.includes(theme));
}

export function quotasComplete(counts: ThemeCounts, limit: number) {
  return lichessPuzzleThemes.every((theme) => counts[theme] >= limit);
}

export function tryAddFast<T extends ImportCandidate>(candidate: T, selected: Map<string, T>, counts: ThemeCounts, limit: number) {
  if (selected.has(candidate.lichess_puzzle_id)) return false;
  const themes = targetThemesFor(candidate);
  if (!themes.length || themes.some((theme) => counts[theme] >= limit)) return false;
  selected.set(candidate.lichess_puzzle_id, candidate);
  for (const theme of themes) counts[theme] += 1;
  return true;
}

export type ThemeReservoirs<T extends ImportCandidate> = Record<LichessPuzzleTheme, T[]>;

export function emptyReservoirs<T extends ImportCandidate>(): ThemeReservoirs<T> {
  return { fork: [], pin: [], skewer: [], mateIn1: [] };
}

export function considerForReservoir<T extends ImportCandidate>(
  candidate: T,
  reservoirs: ThemeReservoirs<T>,
  qualifyingCounts: ThemeCounts,
  limit: number,
  random = Math.random
) {
  for (const theme of targetThemesFor(candidate)) {
    qualifyingCounts[theme] += 1;
    const bucket = reservoirs[theme];
    if (bucket.length < limit) {
      bucket.push(candidate);
      continue;
    }
    const slot = Math.floor(random() * qualifyingCounts[theme]);
    if (slot < limit) bucket[slot] = candidate;
  }
}

function shuffled<T>(values: T[], random: () => number) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function finalizeReservoirs<T extends ImportCandidate>(reservoirs: ThemeReservoirs<T>, limit: number, random = Math.random) {
  const buckets = Object.fromEntries(
    lichessPuzzleThemes.map((theme) => [theme, shuffled(reservoirs[theme], random)])
  ) as ThemeReservoirs<T>;
  const indexes = emptyThemeCounts();
  const counts = emptyThemeCounts();
  const selected = new Map<string, T>();

  let madeProgress = true;
  while (madeProgress && !quotasComplete(counts, limit)) {
    madeProgress = false;
    const themesByNeed = [...lichessPuzzleThemes].sort((left, right) => counts[left] - counts[right]);
    for (const theme of themesByNeed) {
      if (counts[theme] >= limit) continue;
      const bucket = buckets[theme];
      while (indexes[theme] < bucket.length) {
        const candidate = bucket[indexes[theme]];
        indexes[theme] += 1;
        if (selected.has(candidate.lichess_puzzle_id)) continue;
        const candidateThemes = targetThemesFor(candidate);
        if (candidateThemes.some((candidateTheme) => counts[candidateTheme] >= limit)) continue;
        selected.set(candidate.lichess_puzzle_id, candidate);
        for (const candidateTheme of candidateThemes) counts[candidateTheme] += 1;
        madeProgress = true;
        break;
      }
    }
  }

  return { selected, counts };
}
