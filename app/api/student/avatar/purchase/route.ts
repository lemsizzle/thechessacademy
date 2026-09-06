import { purchaseAvatarItem } from "@/lib/avatar/supabaseAvatar";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireActiveStudent();
    const body = await request.json().catch(() => null) as { itemId?: unknown } | null;
    if (typeof body?.itemId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.itemId)) {
      return NextResponse.json({ error: "Choose an item to purchase." }, { status: 400 });
    }
    const state = await purchaseAvatarItem(session.studentId, body.itemId);
    return NextResponse.json({ ok: true, ...state, message: "Item purchased." });
  } catch (error) {
    if (error instanceof StudentAuthenticationError) return NextResponse.json({ error: "Student log in required." }, { status: 401 });
    const message = error instanceof Error ? error.message : "Purchase failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
