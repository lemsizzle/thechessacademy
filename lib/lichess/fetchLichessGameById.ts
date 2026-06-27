import type { LichessGame } from "@/lib/types";

type LichessGameResponse = {
  id?: string;
  rated?: boolean;
  speed?: string;
  perf?: string;
  winner?: "white" | "black";
  moves?: string;
  pgn?: string;
  status?: string;
  opening?: { name?: string };
  players?: {
    white?: { user?: { name?: string; id?: string }; rating?: number };
    black?: { user?: { name?: string; id?: string }; rating?: number };
  };
};

function mockGame(gameId: string): LichessGame {
  return {
    gameId,
    url: `https://lichess.org/${gameId}`,
    whiteUsername: "student-player",
    blackUsername: "training-rival",
    whiteRating: 1210,
    blackRating: 1184,
    speed: "rapid",
    perfType: "rapid",
    rated: true,
    winner: "white",
    result: "white won",
    opening: "Ruy Lopez",
    moves: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 Nxe5+",
    pgn: "[White \"student-player\"]\n[Black \"training-rival\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. Nxe5+ 1-0",
    rawData: { source: "mock" }
  };
}

export async function fetchLichessGameById(gameId: string): Promise<{ game: LichessGame; mode: "connected" | "mock"; message: string }> {
  try {
    const params = new URLSearchParams({
      moves: "true",
      tags: "true",
      opening: "true",
      evals: "true",
      accuracy: "true",
      clocks: "false",
      pgnInJson: "true"
    });
    const response = await fetch(`https://lichess.org/game/export/${encodeURIComponent(gameId)}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      return { game: mockGame(gameId), mode: "mock", message: "Could not fetch the Lichess game, so a mock game was used for testing." };
    }

    const parsed = await response.json() as LichessGameResponse;
    const white = parsed.players?.white;
    const black = parsed.players?.black;
    const game: LichessGame = {
      gameId: parsed.id ?? gameId,
      url: `https://lichess.org/${parsed.id ?? gameId}`,
      whiteUsername: white?.user?.name ?? white?.user?.id ?? "White",
      blackUsername: black?.user?.name ?? black?.user?.id ?? "Black",
      whiteRating: white?.rating,
      blackRating: black?.rating,
      speed: parsed.speed,
      perfType: parsed.perf,
      rated: parsed.rated === true,
      winner: parsed.winner,
      result: parsed.winner ? `${parsed.winner} won` : parsed.status,
      opening: parsed.opening?.name,
      moves: parsed.moves ?? "",
      pgn: parsed.pgn,
      rawData: parsed
    };
    return { game, mode: "connected", message: "Fetched game from Lichess." };
  } catch {
    return { game: mockGame(gameId), mode: "mock", message: "Lichess could not be reached, so a mock game was used for testing." };
  }
}
