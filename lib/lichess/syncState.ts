import { isSupabaseServiceConfigured, getSupabaseServiceClient } from "@/lib/supabase/server";

export type LichessSyncState = {
  studentId: string;
  lichessUsername: string;
  lastSuccessfulSyncAt?: string;
  lastAttemptedSyncAt?: string;
  nextAllowedSyncAt?: string;
  lastError?: string;
  rateLimitCount: number;
  requestCount: number;
  updatedAt?: string;
};

type SyncStateRow = {
  student_id: string;
  lichess_username: string;
  last_successful_sync_at: string | null;
  last_attempted_sync_at: string | null;
  next_allowed_sync_at: string | null;
  last_error: string | null;
  rate_limit_count: number | null;
  request_count: number | null;
  updated_at: string | null;
};

function mapRow(row: SyncStateRow): LichessSyncState {
  return {
    studentId: row.student_id,
    lichessUsername: row.lichess_username,
    lastSuccessfulSyncAt: row.last_successful_sync_at ?? undefined,
    lastAttemptedSyncAt: row.last_attempted_sync_at ?? undefined,
    nextAllowedSyncAt: row.next_allowed_sync_at ?? undefined,
    lastError: row.last_error ?? undefined,
    rateLimitCount: row.rate_limit_count ?? 0,
    requestCount: row.request_count ?? 0,
    updatedAt: row.updated_at ?? undefined
  };
}

export function getCooldownSeconds(state?: LichessSyncState | null) {
  if (!state?.nextAllowedSyncAt) return 0;
  return Math.max(0, Math.ceil((new Date(state.nextAllowedSyncAt).getTime() - Date.now()) / 1000));
}

export function nextBackoffSeconds(previousRateLimitCount: number, retryAfterSeconds = 60) {
  const schedule = [60, 120, 300];
  const scheduled = schedule[Math.min(previousRateLimitCount, schedule.length - 1)] ?? 300;
  return Math.max(scheduled, retryAfterSeconds);
}

export async function getLichessSyncState(studentId: string) {
  if (!isSupabaseServiceConfigured()) return null;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("lichess_sync_state")
    .select("student_id,lichess_username,last_successful_sync_at,last_attempted_sync_at,next_allowed_sync_at,last_error,rate_limit_count,request_count,updated_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) return null;
  return data ? mapRow(data as SyncStateRow) : null;
}

export async function recordLichessSyncAttempt(studentId: string, lichessUsername: string) {
  if (!isSupabaseServiceConfigured()) return;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  await supabase.from("lichess_sync_state").upsert({
    student_id: studentId,
    lichess_username: lichessUsername,
    last_attempted_sync_at: now,
    updated_at: now
  }, { onConflict: "student_id" });
}

export async function recordLichessSyncSuccess(studentId: string, lichessUsername: string, requestCount: number) {
  if (!isSupabaseServiceConfigured()) return;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  const now = new Date().toISOString();
  await supabase.from("lichess_sync_state").upsert({
    student_id: studentId,
    lichess_username: lichessUsername,
    last_successful_sync_at: now,
    last_attempted_sync_at: now,
    next_allowed_sync_at: null,
    last_error: null,
    rate_limit_count: 0,
    request_count: requestCount,
    updated_at: now
  }, { onConflict: "student_id" });
}

export async function recordLichessSyncRateLimit(studentId: string, lichessUsername: string, message: string, retryAfterSeconds: number) {
  const current = await getLichessSyncState(studentId);
  if (!isSupabaseServiceConfigured()) return;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  const now = new Date();
  const rateLimitCount = (current?.rateLimitCount ?? 0) + 1;
  const backoffSeconds = nextBackoffSeconds(rateLimitCount - 1, retryAfterSeconds);
  await supabase.from("lichess_sync_state").upsert({
    student_id: studentId,
    lichess_username: lichessUsername,
    last_attempted_sync_at: now.toISOString(),
    next_allowed_sync_at: new Date(now.getTime() + backoffSeconds * 1000).toISOString(),
    last_error: message,
    rate_limit_count: rateLimitCount,
    request_count: current?.requestCount ?? 0,
    updated_at: now.toISOString()
  }, { onConflict: "student_id" });
}
