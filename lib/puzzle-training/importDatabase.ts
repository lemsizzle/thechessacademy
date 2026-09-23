import type { SupabaseClient } from "@supabase/supabase-js";

/** Network retries cannot duplicate rows or rewrite a puzzle already in use. */
export async function insertNewPuzzleBatch(db: SupabaseClient, rows: Array<{ lichess_puzzle_id: string }>, wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error, count, status } = await db.from("chess_puzzles").upsert(rows, {
      onConflict: "lichess_puzzle_id", ignoreDuplicates: true, count: "exact"
    });
    if (!error) return count ?? 0;
    const transient = !status || status >= 500 || status === 429;
    if (!transient || attempt === 2) throw new Error(`Supabase import failed: ${error.message}`);
    await wait(1000 * (attempt + 1));
  }
  return 0;
}

/** Only IDs leave the database; answers and student records are never downloaded. */
export async function loadExistingPuzzleIds(db: SupabaseClient) {
  const ids = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    let query = db.from("chess_puzzles").select("lichess_puzzle_id")
      .not("lichess_puzzle_id", "is", null)
      .order("lichess_puzzle_id", { ascending: true }).limit(1000);
    if (cursor) query = query.gt("lichess_puzzle_id", cursor);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load existing puzzle IDs: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) ids.add(row.lichess_puzzle_id);
    const next = data[data.length - 1].lichess_puzzle_id;
    if (next === cursor) throw new Error("Puzzle ID pagination did not advance.");
    cursor = next;
  }
  return ids;
}
