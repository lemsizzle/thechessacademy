export function parseLichessGameUrl(input: string) {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || url.hostname !== "lichess.org") {
      return { ok: false as const, error: "Use a valid https://lichess.org game link." };
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const gameId = parts[0]?.replace(/[^a-zA-Z0-9]/g, "");
    const color = parts[1] === "white" || parts[1] === "black" ? parts[1] : "auto";

    if (!gameId || !/^[a-zA-Z0-9]{8,12}$/.test(gameId)) {
      return { ok: false as const, error: "That does not look like a valid Lichess game ID." };
    }

    return {
      ok: true as const,
      gameId,
      color,
      canonicalUrl: `https://lichess.org/${gameId}${color !== "auto" ? `/${color}` : ""}`
    };
  } catch {
    return { ok: false as const, error: "Use a valid https://lichess.org game link." };
  }
}
