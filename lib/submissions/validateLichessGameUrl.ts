export function validateLichessGameUrl(input: string) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || url.hostname !== "lichess.org") {
      return { ok: false as const, error: "Use a valid https://lichess.org game link." };
    }
    const gameId = url.pathname.split("/").filter(Boolean)[0]?.replace(/[^a-zA-Z0-9]/g, "");
    if (!gameId || !/^[a-zA-Z0-9]{8,12}$/.test(gameId)) {
      return { ok: false as const, error: "That does not look like a valid Lichess game ID." };
    }
    return { ok: true as const, gameId, url: `https://lichess.org/${gameId}` };
  } catch {
    return { ok: false as const, error: "Use a valid https://lichess.org game link." };
  }
}
