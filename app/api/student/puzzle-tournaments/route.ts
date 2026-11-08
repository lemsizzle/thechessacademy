import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { battleBody, battleHttpError, battleJson } from "@/lib/puzzle-battle/http";
import { getPuzzleTournament, listPuzzleTournaments, studentPuzzleTournamentAction } from "@/lib/puzzle-battle/tournamentServer";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await requireActiveStudent(), id = new URL(request.url).searchParams.get("id");
    return battleJson(id ? { tournament: await getPuzzleTournament(id, false, user.studentId) } : { tournaments: await listPuzzleTournaments() });
  } catch (error) { return battleHttpError(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireActiveStudent();
    return battleJson({ tournament: await studentPuzzleTournamentAction(await battleBody(request) ?? {}, user) });
  } catch (error) { return battleHttpError(error); }
}
