import { purchaseAvatarItem } from "@/lib/avatar/supabaseAvatar";
import { readStudentSession } from "@/lib/auth/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = readStudentSession(await cookies());
  if (!session || !session.onboardingCompleted) {
    return NextResponse.json({ error: "Student log in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { itemId?: string };
  if (!body.itemId) return NextResponse.json({ error: "Choose an item to purchase." }, { status: 400 });

  try {
    const state = await purchaseAvatarItem(session.studentId, body.itemId);
    return NextResponse.json({ ok: true, ...state, message: "Item purchased." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Purchase failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
