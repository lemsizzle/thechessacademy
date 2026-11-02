import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import {
  createBattle,
  joinBattle,
  battleLobby,
  rematchBattle,
} from "@/lib/puzzle-battle/server";
import {
  battleBody,
  battleHttpError,
  battleJson,
} from "@/lib/puzzle-battle/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await requireActiveStudent();
    return battleJson(await battleLobby(user.studentId));
  } catch (error) {
    return battleHttpError(error);
  }
}
export async function POST(request: Request) {
  try {
    const user = await requireActiveStudent(),
      body = await battleBody(request),
      student = { id: user.studentId, name: user.name };
    return battleJson(
      {
        battle:
          body?.action === "join"
            ? await joinBattle(body.code, student)
            : body?.action === "rematch"
              ? await rematchBattle(body.battleId, student)
            : await createBattle(student, body?.mode, body?.duration, body?.botLevel),
      },
      201,
    );
  } catch (error) {
    return battleHttpError(error);
  }
}
