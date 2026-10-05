import { beforeEach, expect, it, vi } from "vitest";
import { createEmptyAnalysisTree } from "@/chess/analysis/tree";
const { service } = vi.hoisted(() => ({ service: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: service }));
import { createChapter } from "@/chess/persistence/studyServer";

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
const recoveryId = "33333333-3333-4333-8333-333333333333";
const input = () => ({ title: "Recovered", analysisTree: createEmptyAnalysisTree(), recoveryId });
const admin = { kind: "admin" } as const;

beforeEach(() => {
  tables = {
    chess_studies: [{ id: "study", owner_kind: "student", owner_student_id: "owner" }],
    chess_study_members: [], chess_study_chapters: []
  };
  service.mockReturnValue({ from(table: string) {
    const filters: Array<[string, unknown]> = [];
    let insertion: Row | undefined;
    const rows = () => tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      order() { return Promise.resolve({ data: [...rows()], error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows()[0] ?? null, error: null }); },
      insert(row: Row) { insertion = row; return query; },
      single() {
        if (!insertion) throw new Error("Unexpected read");
        if (tables[table].some(row => row.id === insertion!.id || (row.study_id === insertion!.study_id && row.sort_order === insertion!.sort_order))) {
          return Promise.resolve({ data: null, error: { code: "23505", message: "unique constraint" } });
        }
        const row = { ...insertion, version: 1, updated_at: "2026-10-05T00:00:00Z" };
        tables[table].push(row);
        return Promise.resolve({ data: row, error: null });
      }
    };
    return query;
  } });
});

it("retries after an uncertain response reuse the saved copy without overwriting it", async () => {
  const request = input();
  const first = await createChapter(admin, "study", request);
  tables.chess_study_chapters[0].title = "Edited after recovery";
  const second = await createChapter(admin, "study", request);
  expect(first.id).toBe(recoveryId);
  expect(second.title).toBe("Edited after recovery");
  expect(tables.chess_study_chapters).toHaveLength(1);
});
it("two concurrent recoveries of the same snapshot resolve to one chapter", async () => {
  const request = input();
  const [first, second] = await Promise.all([createChapter(admin, "study", request), createChapter(admin, "study", request)]);
  expect(first.id).toBe(second.id);
  expect(tables.chess_study_chapters).toHaveLength(1);
});
it("checks write permission before looking up a recovery identifier", async () => {
  await expect(createChapter({ kind: "student", studentId: "other", name: "Other" }, "study", input())).rejects.toThrow("permission");
  expect(tables.chess_study_chapters).toHaveLength(0);
});
it("does not reuse an unrelated chapter with a colliding identifier", async () => {
  tables.chess_study_chapters.push({ id: recoveryId, study_id: "study", metadata: {}, sort_order: 0 });
  await expect(createChapter(admin, "study", input())).rejects.toThrow("Invalid recovery identifier");
});
it("never retrieves or changes a colliding chapter in another study", async () => {
  tables.chess_study_chapters.push({ id: recoveryId, study_id: "different-study", metadata: { recoveryDraftId: recoveryId }, sort_order: 0 });
  await expect(createChapter(admin, "study", input())).rejects.toThrow("unique constraint");
  expect(tables.chess_study_chapters[0].study_id).toBe("different-study");
});
it("rejects arbitrary IDs and mixed recovery sources", async () => {
  await expect(createChapter(admin, "study", { ...input(), recoveryId: "invalid" })).rejects.toThrow("Invalid recovery request");
  await expect(createChapter(admin, "study", { ...input(), pgn: "1. e4 *" })).rejects.toThrow("Invalid recovery request");
  expect(tables.chess_study_chapters).toHaveLength(0);
});
