import { describe, expect, it } from "vitest";
import { celebrationPosition } from "@/lib/celebrations";

describe("board-safe celebration placement", () => {
  it("keeps a popup below a landscape tablet board", () => {
    expect(celebrationPosition(1024, 768, [{ left: 300, top: 240, right: 700, bottom: 670 }], false)).toEqual({ left: 692, top: 692 });
  });
  it("uses the opposite corner if the bottom right covers a board", () => {
    expect(celebrationPosition(1024, 768, [{ left: 400, top: 150, right: 1000, bottom: 760 }], false)).toEqual({ left: 12, top: 692 });
  });
  it("never covers a board even if every corner is occupied", () => {
    expect(celebrationPosition(768, 1024, [{ left: 0, top: 0, right: 768, bottom: 1024 }], false)).toBeNull();
  });
  it("leaves room for mobile navigation", () => {
    expect(celebrationPosition(390, 844, [], true)?.top).toBe(700);
  });
});
