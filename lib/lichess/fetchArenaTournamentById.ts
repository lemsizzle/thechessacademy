export class LichessArenaFetchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function fetchArenaTournamentById(tournamentId: string) {
  const response = await fetch(`https://lichess.org/api/tournament/${encodeURIComponent(tournamentId)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new LichessArenaFetchError(`Lichess Arena import failed with ${response.status}${retryAfter ? `. Retry after ${retryAfter} seconds` : ""}.`, response.status);
  }
  return await response.json() as Record<string, unknown>;
}
