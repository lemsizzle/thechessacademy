import type { ArenaTournamentResult } from "@/lib/types";

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeArenaTournamentResult(raw: Record<string, unknown>, tournamentId: string, lichessTournamentId: string): ArenaTournamentResult | undefined {
  const user = objectValue(raw.user);
  const username = stringValue(raw.username) ?? stringValue(user?.name) ?? stringValue(user?.id);
  if (!username) return undefined;

  return {
    id: `arena-result-${lichessTournamentId}-${username.toLowerCase()}`,
    tournamentId,
    lichessTournamentId,
    lichessUsername: username,
    rank: numberValue(raw.rank),
    score: numberValue(raw.score),
    rating: numberValue(raw.rating) || undefined,
    performance: numberValue(raw.performance) || numberValue(raw.performanceRating) || undefined,
    matched: false,
    rawData: raw,
    importedAt: new Date().toISOString()
  };
}
