import { NextResponse } from "next/server";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { BattleError } from "./rules";
export function battleJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function battleHttpError(error: unknown) {
  return battleJson(
    {
      error:
        error instanceof BattleError
          ? error.message
          : error instanceof StudentAuthenticationError
            ? "Please log in to play."
            : "Puzzle Battle couldn't connect. Please retry.",
    },
    error instanceof BattleError
      ? error.status
      : error instanceof StudentAuthenticationError
        ? 401
        : 503,
  );
}
export async function battleBody(request: Request) {
  const text = await request.text();
  if (text.length > 16_384)
    throw new BattleError("Battle request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new BattleError("Invalid battle request.");
  }
}
