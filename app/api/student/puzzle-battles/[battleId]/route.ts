import { requireSignedInStudent } from "@/lib/auth/requireActiveStudent";
import { actOnBattle, readBattle } from "@/lib/puzzle-battle/server";
import {
  battleBody,
  battleHttpError,
  battleJson,
} from "@/lib/puzzle-battle/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ battleId: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireSignedInStudent();
    return battleJson({
      battle: await readBattle((await context.params).battleId, user.studentId, user),
    });
  } catch (error) {
    return battleHttpError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const user = await requireSignedInStudent();
    return battleJson({
      battle: await actOnBattle(
        (await context.params).battleId,
        { id: user.studentId, name: user.name },
        await battleBody(request),
        user,
      ),
    });
  } catch (error) {
    return battleHttpError(error);
  }
}
