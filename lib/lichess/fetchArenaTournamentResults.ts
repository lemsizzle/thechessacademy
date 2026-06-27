import { parseNdjson } from "@/lib/lichess/parseNdjson";

export async function fetchArenaTournamentResults(tournamentId: string) {
  const response = await fetch(`https://lichess.org/api/tournament/${encodeURIComponent(tournamentId)}/results`, {
    headers: { Accept: "application/x-ndjson" },
    cache: "no-store"
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`Lichess Arena results sync failed with ${response.status}${retryAfter ? `. Retry after ${retryAfter} seconds` : ""}.`);
  }
  return parseNdjson<Record<string, unknown>>(await response.text());
}
