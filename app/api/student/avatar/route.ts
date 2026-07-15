import { readStudentSession } from "@/lib/auth/session";
import { getStudentAvatarState, saveStudentAvatar } from "@/lib/avatar/supabaseAvatar";
import type { AvatarCategory } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = readStudentSession(await cookies());
  if (!session || !session.onboardingCompleted) {
    return NextResponse.json({ error: "Student log in required." }, { status: 401 });
  }

  const state = await getStudentAvatarState(session.studentId);
  return NextResponse.json(state);
}

export async function PATCH(request: Request) {
  const session = readStudentSession(await cookies());
  if (!session || !session.onboardingCompleted) {
    return NextResponse.json({ error: "Student log in required." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { equippedItems?: Partial<Record<AvatarCategory, string | null>> };
    const state = await saveStudentAvatar(session.studentId, body.equippedItems ?? {});
    return NextResponse.json({ ok: true, ...state, message: "Avatar saved." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save avatar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
