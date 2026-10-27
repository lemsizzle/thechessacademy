import { describe, expect, it } from "vitest";
import { parseTeacherPreviewIds, teacherPreviewGames } from "@/chess/live/teacherPreviews";
import type { TeacherLiveGameSummary } from "@/chess/live/types";
const games = (...ids: string[]) => ids.map(id => ({ id } as TeacherLiveGameSummary));
const ids = (list: TeacherLiveGameSummary[]) => list.map(game => game.id);

describe("teacher multi-board selection", () => {
  it("starts with the top three, or however many games are available", () => {
    expect(ids(teacherPreviewGames(games("a", "b", "c", "d")))).toEqual(["a", "b", "c"]);
    expect(ids(teacherPreviewGames(games("a")))).toEqual(["a"]);
    expect(teacherPreviewGames([])).toEqual([]);
  });
  it("keeps board slots stable as the recently updated order changes", () => {
    expect(ids(teacherPreviewGames(games("d", "c", "a", "b"), ["a", "b", "c"]))).toEqual(["a", "b", "c"]);
  });
  it("replaces a finished board in its slot without moving the other students", () => {
    expect(ids(teacherPreviewGames(games("d", "c", "b"), ["a", "b", "c"]))).toEqual(["d", "b", "c"]);
    expect(ids(teacherPreviewGames(games("d", "c", "a"), ["a", "b", "c"]))).toEqual(["a", "d", "c"]);
  });
  it("never loads unknown IDs or more than three requested boards", () => {
    expect(ids(teacherPreviewGames(games("a", "b", "c", "d"), ["unknown", "a", "a", "b", "c", "d"]))).toEqual(["c", "a", "b"]);
    const id = "56be1301-448a-4f10-b211-de23b8387bf5";
    expect(parseTeacherPreviewIds(`bad,${id},computer-${id},${id},${id}`)).toHaveLength(3);
    expect(parseTeacherPreviewIds("<script>,not-a-game")).toEqual([]);
  });
});
