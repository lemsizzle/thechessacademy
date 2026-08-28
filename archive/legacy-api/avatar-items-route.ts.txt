import { listAvatarItems } from "@/lib/avatar/supabaseAvatar";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listAvatarItems();
  return NextResponse.json({ items });
}
