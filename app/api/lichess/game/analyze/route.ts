import { detectTacticCandidates } from "@/lib/game-analysis/detectTacticCandidates";
import { explainTacticWithAI } from "@/lib/game-analysis/explainTacticWithAI";
import { replayGame } from "@/lib/game-analysis/replayGame";
import { fetchLichessGameById } from "@/lib/lichess/fetchLichessGameById";
import { parseLichessGameUrl } from "@/lib/lichess/parseLichessGameUrl";
import type { GameAnalysisRequest, StudentColor } from "@/lib/types";
import { NextResponse } from "next/server";

function chooseColor(input: StudentColor, parsedColor: StudentColor, studentUsername: string | undefined, whiteUsername: string, blackUsername: string): "white" | "black" {
  if (input === "white" || input === "black") return input;
  if (parsedColor === "white" || parsedColor === "black") return parsedColor;
  const username = studentUsername?.toLowerCase();
  if (username && whiteUsername.toLowerCase() === username) return "white";
  if (username && blackUsername.toLowerCase() === username) return "black";
  return "white";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    url?: string;
    studentId?: string;
    studentUsername?: string;
    studentColor?: StudentColor;
  };
  const parsed = parseLichessGameUrl(body.url ?? "");
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!body.studentId) return NextResponse.json({ error: "Choose a student before analyzing." }, { status: 400 });

  const { game, mode, message } = await fetchLichessGameById(parsed.gameId);
  const replay = replayGame(game.pgn || game.moves);
  const studentColor = chooseColor(body.studentColor ?? "auto", parsed.color as StudentColor, body.studentUsername, game.whiteUsername, game.blackUsername);
  const requestId = `analysis-${body.studentId}-${game.gameId}-${Date.now()}`;
  const analysisRequest: GameAnalysisRequest = {
    id: requestId,
    studentId: body.studentId,
    lichessGameId: game.gameId,
    lichessUrl: parsed.canonicalUrl,
    studentColor,
    status: "completed",
    requestedBy: "Teacher",
    createdAt: new Date().toISOString().slice(0, 10),
    completedAt: new Date().toISOString().slice(0, 10),
    rawGameData: game.rawData
  };
  const candidates = detectTacticCandidates({
    analysisRequestId: requestId,
    studentId: body.studentId,
    gameId: game.gameId,
    studentColor,
    moves: replay.moves
  });
  const findings = await Promise.all(candidates.map(async (finding) => ({
    ...finding,
    ...(await explainTacticWithAI(finding, studentColor))
  })));

  return NextResponse.json({
    mode,
    message,
    game: { ...game, finalFen: replay.finalFen },
    analysisRequest,
    findings,
    usedMockAi: !process.env.OPENAI_API_KEY
  });
}
