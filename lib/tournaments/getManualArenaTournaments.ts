import type { Tournament } from "@/lib/types";

export function getManualArenaTournaments(tournaments: Tournament[] = []) {
  return tournaments.flatMap((tournament) => {
    const legacyType = (tournament as Tournament & { type?: string }).type;
    if (legacyType !== undefined && legacyType !== "arena") return [];
    return [{ ...tournament, source: "manual_fallback" as const }];
  });
}
