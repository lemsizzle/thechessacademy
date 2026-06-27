import { fetchArenaTournamentById, LichessArenaFetchError } from "@/lib/lichess/fetchArenaTournamentById";
import { normalizeArenaTournament } from "@/lib/tournaments/normalizeArenaTournament";
import { parseLichessTournamentUrl } from "@/lib/tournaments/parseLichessTournamentUrl";

export async function importArenaTournament(input: string) {
  const parsed = parseLichessTournamentUrl(input);
  if (!parsed.ok) return parsed;

  try {
    const raw = await fetchArenaTournamentById(parsed.tournamentId);
    return {
      ok: true as const,
      mode: "connected" as const,
      tournament: normalizeArenaTournament(raw, {
        source: "imported_url",
        importedAt: new Date().toISOString(),
        isPublic: false
      })
    };
  } catch (error) {
    if (error instanceof LichessArenaFetchError && error.status >= 400 && error.status < 500 && error.status !== 429) {
      return { ok: false as const, error: "Lichess could not find that Arena tournament. Check the URL or ID." };
    }
    const now = Date.now();
    return {
      ok: true as const,
      mode: "mock" as const,
      warning: error instanceof Error ? error.message : "Could not load Arena metadata.",
      tournament: normalizeArenaTournament({
        id: parsed.tournamentId,
        name: `Imported Arena ${parsed.tournamentId}`,
        status: "created",
        startsAt: now + 24 * 60 * 60 * 1000,
        minutes: 60,
        url: `https://lichess.org/tournament/${parsed.tournamentId}`,
        variant: { key: "standard" }
      }, {
        source: "imported_url",
        importedAt: new Date().toISOString(),
        isPublic: false
      })
    };
  }
}
