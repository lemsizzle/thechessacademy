import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { getLichessSyncState } from "@/lib/lichess/syncState";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const isAdmin = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
  if (!isAdmin) return NextResponse.json({ error: "Teacher login required." }, { status: 401 });

  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const syncState = studentId ? await getLichessSyncState(studentId) : null;

  return NextResponse.json({
    env: {
      nextPublicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      lichessClientId: Boolean(process.env.LICHESS_CLIENT_ID),
      lichessRedirectUri: Boolean(process.env.LICHESS_REDIRECT_URI),
      lichessEncryptionSecret: Boolean(process.env.LICHESS_ENCRYPTION_SECRET),
      lichessTeamId: Boolean(process.env.LICHESS_TEAM_ID),
      tournamentSyncInterval: Boolean(process.env.LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES),
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    },
    syncState
  });
}
