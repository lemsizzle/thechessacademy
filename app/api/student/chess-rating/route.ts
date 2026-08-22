import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: false, error: "Chess ratings are available to teachers only." }, { status: 403 });
}
