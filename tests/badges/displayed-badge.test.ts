import { describe, expect, it, vi } from "vitest";
import { displayedBadgeLabel, parseDisplayedBadgeChoice, toDisplayedBadge } from "@/lib/badges/displayedBadge";
import { readDisplayedBadges } from "@/lib/badges/displayedBadgeRead";
import type { SupabaseClient } from "@supabase/supabase-js";

const id = "97ae1da4-b212-4e5e-bb81-00baeb71a119";
const row = { id, name: "Fork Finder", category: "Tactics", tier: "SS", final_image_url: "/final.webp", art_image_url: "/draft.webp" };

describe("displayed badge metadata", () => {
  it("uses final artwork and distinguishes legacy tiers without repeating names", () => {
    const badge = toDisplayedBadge(row);
    expect(badge).toEqual({ id, name: "Fork Finder", tier: "Adamantium", imageUrl: "/final.webp" });
    expect(displayedBadgeLabel(badge)).toBe("Fork Finder · Adamantium");
    expect(displayedBadgeLabel({ ...badge, name: "Fork Finder Adamantium" })).toBe("Fork Finder Adamantium");
    expect(toDisplayedBadge({ ...row, category: "Concept Badges", final_image_url: null }).tier).toBeUndefined();
    expect(toDisplayedBadge({ ...row, final_image_url: null }).imageUrl).toBe("/draft.webp");
    expect(toDisplayedBadge({ ...row, final_image_url: null, art_image_url: null }).imageUrl).toContain("/mock-badge-art/");
  });
  it("accepts explicit clearing and valid IDs without trusting client student identity", () => {
    expect(parseDisplayedBadgeChoice({ badgeId: null })).toBeNull();
    expect(parseDisplayedBadgeChoice({ badgeId: id, studentId: "another-student" })).toBe(id);
  });
  it.each([null, [], {}, { badgeId: "" }, { badgeId: 123 }, { badgeId: "not-a-uuid" }])("rejects malformed choices (%j)", (body) => {
    expect(() => parseDisplayedBadgeChoice(body)).toThrow();
  });
  it("reads selected badges in one batch without full badge collections or evidence", async () => {
    const query = { select: vi.fn((_columns: string) => query), eq: vi.fn(() => query), in: vi.fn().mockResolvedValue({ data: [{ student_id: "learner", badges: row }, { student_id: "revoked", badges: null }], error: null }) };
    const from = vi.fn(() => query);
    const result = await readDisplayedBadges({ from } as unknown as SupabaseClient, ["learner", "learner", "", "revoked"]);
    expect(from).toHaveBeenCalledExactlyOnceWith("student_badges");
    expect(query.eq).toHaveBeenCalledWith("is_displayed", true);
    expect(query.in).toHaveBeenCalledWith("student_id", ["learner", "revoked"]);
    expect(query.select.mock.calls[0][0]).not.toMatch(/evidence|description|\*/);
    expect([...result.keys()]).toEqual(["learner"]);
    expect(result.get("learner")?.id).toBe(id);
    from.mockClear();
    expect((await readDisplayedBadges({ from } as unknown as SupabaseClient, [])).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });
});
