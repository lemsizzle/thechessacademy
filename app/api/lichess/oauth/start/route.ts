import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("/api/auth/lichess/start", url.origin);
  for (const key of ["student", "returnTo", "mock"]) {
    const value = url.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target);
}
