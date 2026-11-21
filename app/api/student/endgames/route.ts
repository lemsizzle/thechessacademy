import { NextRequest, NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { createEndgameRewardToken, EndgameInputError } from "@/lib/endgames/rewardToken";
import { saveEndgameReward } from "@/lib/endgames/rewardsServer";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function POST(request: NextRequest) {
  try {
    const student = await requireActiveStudent();
    const text = await request.text();
    if (text.length > 16000) throw new EndgameInputError("Practice request is too large.");
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new EndgameInputError("Invalid practice request.");
    if (body.action === "start") return NextResponse.json(createEndgameRewardToken(student.studentId, body.topicId, Date.now(), body.difficulty), { headers });
    if (body.action !== "assist" && body.action !== "complete") throw new EndgameInputError("Invalid practice action.");
    return NextResponse.json(await saveEndgameReward(student.studentId, body), { headers });
  } catch (error) {
    const input = error instanceof EndgameInputError || error instanceof SyntaxError;
    const auth = error instanceof StudentAuthenticationError;
    return NextResponse.json({ error: auth ? "Please log in to save practice rewards." : input ? error.message : "Rewards couldn't be saved. Your position is safe; please retry." }, { status: auth ? 401 : input ? 400 : 503, headers });
  }
}
