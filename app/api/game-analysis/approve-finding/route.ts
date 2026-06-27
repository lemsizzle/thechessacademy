import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: "Finding approval is stored in local mock admin state for this MVP."
  });
}
