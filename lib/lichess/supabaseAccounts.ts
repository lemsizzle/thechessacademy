import "server-only";

import { getSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { StudentLichessAccount } from "@/lib/types";

type AccountRow = {
  student_id: string;
  lichess_user_id: string;
  lichess_username: string;
  account_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toAccount(row: AccountRow): StudentLichessAccount {
  const data = row.account_data ?? {};
  return {
    ...(data as unknown as StudentLichessAccount),
    id: String(data.id ?? `lichess-account-${row.student_id}`),
    studentId: row.student_id,
    lichessUserId: row.lichess_user_id,
    lichessUsername: row.lichess_username,
    lichessProfileUrl: String(data.lichessProfileUrl ?? `https://lichess.org/@/${row.lichess_username}`),
    createdAt: String(data.createdAt ?? row.created_at),
    updatedAt: row.updated_at
  };
}

export async function getStoredLichessAccount(studentId: string) {
  if (!isSupabaseServiceConfigured()) return null;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("student_lichess_accounts")
    .select("student_id,lichess_user_id,lichess_username,account_data,created_at,updated_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAccount(data as AccountRow) : null;
}

export async function listStoredLichessAccounts(studentIds?: string[]) {
  if (!isSupabaseServiceConfigured()) return [];
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];
  let query = supabase
    .from("student_lichess_accounts")
    .select("student_id,lichess_user_id,lichess_username,account_data,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (studentIds?.length) query = query.in("student_id", studentIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as AccountRow[]).map(toAccount);
}

export async function saveStoredLichessAccount(account: StudentLichessAccount) {
  if (!isSupabaseServiceConfigured()) return account;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return account;
  const { data, error } = await supabase
    .from("student_lichess_accounts")
    .upsert({
      student_id: account.studentId,
      lichess_user_id: account.lichessUserId,
      lichess_username: account.lichessUsername,
      account_data: account,
      updated_at: new Date().toISOString()
    }, { onConflict: "student_id" })
    .select("student_id,lichess_user_id,lichess_username,account_data,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return toAccount(data as AccountRow);
}
