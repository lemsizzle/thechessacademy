import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "Manual findings are stored in local mock admin state for this MVP."
  });
}
