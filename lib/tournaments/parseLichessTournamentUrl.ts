const TOURNAMENT_ID_PATTERN = /^[a-zA-Z0-9]{4,20}$/;

export type TournamentIdParseResult =
  | { ok: true; tournamentId: string }
  | { ok: false; error: string };

export function parseLichessTournamentUrl(input: string): TournamentIdParseResult {
  const value = input.trim();
  if (!value) return { ok: false, error: "Paste a Lichess Arena tournament URL or ID." };

  if (TOURNAMENT_ID_PATTERN.test(value)) {
    return { ok: true, tournamentId: value };
  }

  const candidate = /^lichess\.org\//i.test(value) ? `https://${value}` : value;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: "That is not a valid Lichess Arena tournament URL or ID." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only Lichess web URLs are accepted." };
  }
  if (url.hostname.toLowerCase() !== "lichess.org" && url.hostname.toLowerCase() !== "www.lichess.org") {
    return { ok: false, error: "Only lichess.org Arena tournament URLs are accepted." };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() !== "tournament" || !parts[1] || parts.length > 3) {
    return { ok: false, error: "Use an Arena URL such as lichess.org/tournament/abc123." };
  }
  if (parts[2] && !["results", "standings"].includes(parts[2].toLowerCase())) {
    return { ok: false, error: "That Lichess URL is not an Arena tournament page." };
  }
  if (!TOURNAMENT_ID_PATTERN.test(parts[1])) {
    return { ok: false, error: "The Arena tournament ID is not valid." };
  }

  return { ok: true, tournamentId: parts[1] };
}
