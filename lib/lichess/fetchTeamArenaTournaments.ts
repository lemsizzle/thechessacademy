import { parseNdjson } from "@/lib/lichess/parseNdjson";

function extractArenaTournaments(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const record = payload as Record<string, unknown>;
  const direct = ["tournaments", "arena", "arenas", "current", "created", "started", "finished"]
    .flatMap((key) => extractArenaTournaments(record[key]));
  if (direct.length) return direct;
  return "id" in record || "fullName" in record || "name" in record ? [record] : [];
}

export async function fetchTeamArenaTournaments(teamId: string) {
  const params = new URLSearchParams({
    max: process.env.LICHESS_TEAM_TOURNAMENT_MAX ?? "50"
  });
  const response = await fetch(`https://lichess.org/api/team/${encodeURIComponent(teamId)}/arena?${params}`, {
    headers: { Accept: "application/x-ndjson, application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(`Lichess Arena sync failed with ${response.status}${retryAfter ? `. Retry after ${retryAfter} seconds` : ""}.`);
  }
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") && !contentType.includes("x-ndjson")) {
    try {
      return extractArenaTournaments(JSON.parse(text));
    } catch {
      return [];
    }
  }

  const ndjson = parseNdjson<Record<string, unknown>>(text);
  if (ndjson.length) return ndjson;

  try {
    return extractArenaTournaments(JSON.parse(text));
  } catch {
    return [];
  }
}
