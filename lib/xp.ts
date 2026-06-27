import type { Student } from "@/lib/types";

export const LEVEL_CURVE = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 275 },
  { level: 4, xp: 550 },
  { level: 5, xp: 950 },
  { level: 6, xp: 1500 },
  { level: 7, xp: 2250 },
  { level: 8, xp: 3250 },
  { level: 9, xp: 4600 },
  { level: 10, xp: 6400 }
];

export const LEVEL_TITLES = [
  { level: 1, name: "Pawn Initiate", banner: "from-emerald-500/25 via-slate-900 to-slate-950 border-emerald-300/30 text-emerald-100" },
  { level: 2, name: "Knight Scout", banner: "from-lime-400/20 via-slate-900 to-slate-950 border-lime-300/30 text-lime-100" },
  { level: 3, name: "Bishop Adept", banner: "from-cyan-400/20 via-slate-900 to-slate-950 border-cyan-300/30 text-cyan-100" },
  { level: 4, name: "Rook Guardian", banner: "from-sky-400/20 via-slate-900 to-slate-950 border-sky-300/30 text-sky-100" },
  { level: 5, name: "Tactical Mage", banner: "from-violet-400/22 via-slate-900 to-slate-950 border-violet-300/35 text-violet-100" },
  { level: 6, name: "Checkmate Captain", banner: "from-fuchsia-400/22 via-slate-900 to-slate-950 border-fuchsia-300/35 text-fuchsia-100" },
  { level: 7, name: "Endgame Sage", banner: "from-amber-400/22 via-slate-900 to-slate-950 border-amber-300/35 text-amber-100" },
  { level: 8, name: "Royal Strategist", banner: "from-orange-400/22 via-slate-900 to-slate-950 border-orange-300/35 text-orange-100" },
  { level: 9, name: "Academy Champion", banner: "from-rose-400/22 via-slate-900 to-slate-950 border-rose-300/35 text-rose-100" },
  { level: 10, name: "Grandmaster Hero", banner: "from-yellow-200/30 via-fuchsia-500/20 to-cyan-400/20 border-yellow-200/50 text-yellow-50" }
];

export const LEVEL_AVATAR_SYMBOLS = [
  { level: 1, symbol: "\u265F\uFE0F" },
  { level: 2, symbol: "\u265E" },
  { level: 3, symbol: "\u265D" },
  { level: 4, symbol: "\u265C" },
  { level: 5, symbol: "\u265B" },
  { level: 6, symbol: "\u265A" },
  { level: 7, symbol: "\u{1F6E1}\uFE0F" },
  { level: 8, symbol: "\u{1F52E}" },
  { level: 9, symbol: "\u{1F3C6}" },
  { level: 10, symbol: "\u{1F451}" }
];

export function getLevelFromXp(xp: number) {
  return LEVEL_CURVE.reduce((level, row) => (xp >= row.xp ? row.level : level), 1);
}

export function getLevelTitle(level: number) {
  return LEVEL_TITLES.find((item) => item.level === level) ?? LEVEL_TITLES[0];
}

export function getLevelTitleFromXp(xp: number) {
  return getLevelTitle(getLevelFromXp(xp));
}

export function getLevelAvatarSymbol(level: number) {
  return LEVEL_AVATAR_SYMBOLS.find((item) => item.level === level)?.symbol ?? LEVEL_AVATAR_SYMBOLS[0].symbol;
}

export function getLevelCardStyle(level: number) {
  if (level <= 2) {
    return {
      frame: "shadow-[0_0_14px_rgba(16,185,129,0.12)]",
      avatar: "rounded-md border-emerald-200/25 bg-black/35",
      patternOpacity: "opacity-20",
      pattern: "[background-image:linear-gradient(120deg,rgba(255,255,255,.10)_0,transparent_18%),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:90px_72px,22px_22px]",
      accent: "absolute -right-14 top-1/2 h-20 w-44 -translate-y-1/2 rotate-[-16deg] border-y border-emerald-100/15 bg-emerald-200/[0.08]",
      shine: "hidden",
      aura: "from-emerald-300/20 via-transparent to-transparent",
      trim: "border-emerald-200/30",
      rank: "C"
    };
  }

  if (level <= 4) {
    return {
      frame: "shadow-[0_0_22px_rgba(56,189,248,0.20)]",
      avatar: "rounded-md border-cyan-200/35 bg-black/35 shadow-[0_0_14px_rgba(56,189,248,0.18)]",
      patternOpacity: "opacity-30",
      pattern: "[background-image:linear-gradient(135deg,rgba(255,255,255,.16)_0,transparent_18%,transparent_36%,rgba(56,189,248,.12)_37%,transparent_41%),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:110px_78px,18px_18px]",
      accent: "absolute -right-10 top-1/2 h-24 w-48 -translate-y-1/2 rotate-[-14deg] border-y border-cyan-100/25 bg-cyan-300/10",
      shine: "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent",
      aura: "from-cyan-300/24 via-transparent to-transparent",
      trim: "border-cyan-200/40",
      rank: "B"
    };
  }

  if (level <= 6) {
    return {
      frame: "shadow-[0_0_30px_rgba(168,85,247,0.28)] ring-1 ring-violet-100/10",
      avatar: "rounded-lg border-violet-200/45 bg-black/40 shadow-[0_0_20px_rgba(168,85,247,0.30)]",
      patternOpacity: "opacity-40",
      pattern: "[background-image:linear-gradient(135deg,rgba(255,255,255,.20)_0,transparent_15%,transparent_34%,rgba(217,70,239,.16)_35%,transparent_40%),linear-gradient(90deg,rgba(255,255,255,.10)_1px,transparent_1px)] [background-size:118px_78px,16px_16px]",
      accent: "absolute -right-8 top-1/2 h-28 w-52 -translate-y-1/2 rotate-[-13deg] border-y border-fuchsia-100/30 bg-fuchsia-300/12",
      shine: "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-fuchsia-100/50 to-transparent",
      aura: "from-fuchsia-300/26 via-violet-400/10 to-transparent",
      trim: "border-fuchsia-200/45",
      rank: "A"
    };
  }

  if (level <= 8) {
    return {
      frame: "shadow-[0_0_40px_rgba(245,158,11,0.32)] ring-1 ring-amber-100/15",
      avatar: "rounded-lg border-amber-200/55 bg-black/45 shadow-[0_0_24px_rgba(245,158,11,0.34)]",
      patternOpacity: "opacity-50",
      pattern: "[background-image:radial-gradient(circle_at_18%_24%,rgba(255,255,255,.20),transparent_16%),linear-gradient(135deg,rgba(255,255,255,.22)_0,transparent_15%,transparent_34%,rgba(251,191,36,.18)_35%,transparent_39%),linear-gradient(90deg,rgba(255,255,255,.11)_1px,transparent_1px)] [background-size:78px_78px,104px_74px,14px_14px]",
      accent: "absolute -right-10 top-1/2 h-32 w-56 -translate-y-1/2 rotate-[-12deg] border-y border-amber-100/40 bg-amber-100/14",
      shine: "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-100/65 to-transparent",
      aura: "from-amber-200/28 via-orange-300/12 to-transparent",
      trim: "border-amber-100/55",
      rank: "S"
    };
  }

  return {
    frame: "shadow-[0_0_54px_rgba(236,72,153,0.38)] ring-1 ring-yellow-100/25",
    avatar: "rounded-lg border-yellow-100/70 bg-black/50 shadow-[0_0_34px_rgba(250,204,21,0.40)]",
    patternOpacity: "opacity-60",
    pattern: "[background-image:radial-gradient(circle_at_16%_26%,rgba(255,255,255,.28),transparent_16%),radial-gradient(circle_at_78%_34%,rgba(250,204,21,.24),transparent_18%),linear-gradient(135deg,rgba(255,255,255,.24)_0,transparent_14%,transparent_32%,rgba(236,72,153,.18)_33%,transparent_38%),linear-gradient(90deg,rgba(255,255,255,.13)_1px,transparent_1px)] [background-size:84px_84px,96px_96px,98px_70px,13px_13px]",
    accent: "absolute -right-12 top-1/2 h-36 w-60 -translate-y-1/2 rotate-[-12deg] border-y border-yellow-100/50 bg-gradient-to-r from-yellow-100/18 to-fuchsia-300/18",
    shine: "absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-200/0 via-yellow-100/80 to-fuchsia-200/0",
    aura: "from-yellow-100/30 via-fuchsia-300/16 to-cyan-200/10",
    trim: "border-yellow-100/65",
    rank: "SS"
  };
}

export function getXpProgressToNextLevel(xp: number) {
  const level = getLevelFromXp(xp);
  const current = LEVEL_CURVE.find((row) => row.level === level) ?? LEVEL_CURVE[0];
  const next = LEVEL_CURVE.find((row) => row.level === level + 1);

  if (!next) {
    return { level, currentXp: xp, nextLevelXp: xp, neededXp: 0, percent: 100, isMaxLevel: true };
  }

  const gained = xp - current.xp;
  const needed = next.xp - current.xp;
  return {
    level,
    currentXp: gained,
    nextLevelXp: needed,
    neededXp: next.xp - xp,
    percent: Math.min(100, Math.round((gained / needed) * 100)),
    isMaxLevel: false
  };
}

export function addXpEvent(student: Student, amount: number) {
  return { ...student, totalXp: Math.max(0, student.totalXp + amount) };
}

export function updateStudentXp(student: Student, nextXp: number) {
  return { ...student, totalXp: Math.max(0, nextXp) };
}

export function getStudentRank(students: Student[]) {
  return [...students]
    .sort((a, b) => b.totalXp - a.totalXp)
    .map((student, index) => ({ ...student, rank: index + 1 }));
}
