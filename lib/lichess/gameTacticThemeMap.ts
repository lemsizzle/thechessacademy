import type { TacticTheme } from "@/lib/types";

export const lichessThemeMap: Record<string, TacticTheme> = {
  fork: "Fork",
  pin: "Pin",
  skewer: "Skewer",
  discoveredAttack: "Discovered Attack",
  doubleAttack: "Double Attack",
  deflection: "Deflection",
  attraction: "Decoy",
  decoy: "Decoy",
  removeDefender: "Removing the Defender",
  backRankMate: "Back Rank Mate",
  mateIn1: "Mate in One",
  mateInOne: "Mate in One"
};

export function mapLichessThemeToTactic(theme: string): TacticTheme | null {
  return lichessThemeMap[theme] ?? null;
}
