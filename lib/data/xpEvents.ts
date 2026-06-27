import { xpEvents as mockXpEvents } from "@/data/xpEvents";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { XpEvent } from "@/lib/types";
import { mockResult, shouldUseMock, supabaseResult, type DataResult } from "./shared";

type XpEventRow = {
  id: string;
  student_id: string;
  amount: number;
  reason: string;
  created_at: string;
};

function mapXpEvent(row: XpEventRow): XpEvent {
  return {
    id: row.id,
    studentId: row.student_id,
    amount: row.amount,
    reason: row.reason,
    createdAt: row.created_at
  };
}

export async function getXpEventsResult(): Promise<DataResult<XpEvent[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockXpEvents, "Supabase is not configured.");

  const { data, error } = await supabase
    .from("xp_events")
    .select("id,student_id,amount,reason,created_at")
    .order("created_at", { ascending: false });

  if (shouldUseMock(data, error)) return mockResult(mockXpEvents, error);
  return supabaseResult((data as XpEventRow[]).map(mapXpEvent));
}

export async function getXpEvents() {
  return (await getXpEventsResult()).data;
}

export async function getXpEventsForStudent(studentId: string) {
  const events = await getXpEvents();
  return events.filter((event) => event.studentId === studentId);
}
