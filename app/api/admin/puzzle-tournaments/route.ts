import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";
import { battleBody, battleHttpError, battleJson } from "@/lib/puzzle-battle/http";
import { getPuzzleTournament, listPuzzleTournaments, teacherPuzzleTournamentAction } from "@/lib/puzzle-battle/tournamentServer";
export const dynamic = "force-dynamic";
async function authorized(request: Request) {
  return isAuthorizedAdminRequest((await cookies()).get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"));
}
export async function GET(request: Request) {
  if (!await authorized(request)) return battleJson({ error: "Teacher log in required." }, 401);
  try {
    const id = new URL(request.url).searchParams.get("id");
    return battleJson(id ? { tournament: await getPuzzleTournament(id, true) } : { tournaments: await listPuzzleTournaments() });
  } catch (error) { return battleHttpError(error); }
}
export async function POST(request: Request) {
  if (!await authorized(request)) return battleJson({ error: "Teacher log in required." }, 401);
  try { return battleJson({ tournament: await teacherPuzzleTournamentAction(await battleBody(request) ?? {}) }); }
  catch (error) { return battleHttpError(error); }
}
