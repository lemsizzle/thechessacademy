import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireActiveStudent: vi.fn(), getSupabaseServiceClient: vi.fn(), purchaseAvatarItem: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => {
  class StudentAuthenticationError extends Error {}
  return { requireActiveStudent: mocks.requireActiveStudent, StudentAuthenticationError };
});
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({ purchaseAvatarItem: mocks.purchaseAvatarItem }));

import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { GET } from "@/app/api/student/board-themes/route";
import { POST } from "@/app/api/student/avatar/purchase/route";
import { paperChessSet } from "@/lib/avatar/paperChessSet";
import { blossomChessSet } from "@/lib/avatar/blossomChessSet";

describe("board theme ownership and purchases", () => {
  const studentId = "10000000-0000-4000-8000-000000000001";
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), limit: vi.fn() };
  const from = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveStudent.mockResolvedValue({ studentId });
    mocks.getSupabaseServiceClient.mockReturnValue({ from });
    from.mockReturnValue(query); query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.in.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [], error: null });
    mocks.purchaseAvatarItem.mockResolvedValue({ ownedItemIds: [paperChessSet.id] });
  });
  it("uses only the authenticated student's inventory with slug/category filters", async () => {
    query.limit.mockResolvedValue({ data: [{ avatar_items: { slug: paperChessSet.slug, category: "board_theme" } }], error: null });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ studentId, ownsPaper: true, ownedThemes: ["paper"] });
    expect(from).toHaveBeenCalledExactlyOnceWith("student_inventory");
    expect(query.eq).toHaveBeenCalledWith("student_id", studentId);
    expect(query.in).toHaveBeenCalledWith("avatar_items.slug", ["paper-chess-set", "blossom-chess-set"]);
    expect(query.eq).toHaveBeenCalledWith("avatar_items.category", "board_theme");
  });
  it("does not grant Paper without an inventory row", async () => {
    expect(await (await GET()).json()).toEqual({ studentId, ownsPaper: false, ownedThemes: [] });
  });
  it("purchasing Blossom does not unlock Paper", async () => {
    query.limit.mockResolvedValue({ data: [{ avatar_items: { slug: blossomChessSet.slug, category: "board_theme" } }], error: null });
    expect(await (await GET()).json()).toEqual({ studentId, ownsPaper: false, ownedThemes: ["blossom"] });
  });
  it("returns both owned sets in one bounded query, supporting array-shaped joins", async () => {
    query.limit.mockResolvedValue({ data: [paperChessSet, blossomChessSet].map((item) => ({ avatar_items: [{ slug: item.slug, category: item.category }] })), error: null });
    expect(await (await GET()).json()).toEqual({ studentId, ownsPaper: true, ownedThemes: ["paper", "blossom"] });
    expect(from).toHaveBeenCalledTimes(1);
    expect(query.limit).toHaveBeenCalledWith(2);
  });
  it("does not unlock unknown or miscategorized items", async () => {
    query.limit.mockResolvedValue({ data: [{ avatar_items: { slug: blossomChessSet.slug, category: "background" } }, { avatar_items: { slug: "unknown", category: "board_theme" } }], error: null });
    expect(await (await GET()).json()).toEqual({ studentId, ownsPaper: false, ownedThemes: [] });
  });
  it("fails closed on database errors without leaking server details", async () => {
    query.limit.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database");
  });
  it("rejects unauthenticated/inactive students before querying inventory", async () => {
    mocks.requireActiveStudent.mockRejectedValue(new StudentAuthenticationError("Inactive"));
    expect((await GET()).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  function purchase(body: unknown) { return POST(new Request("http://localhost/api/student/avatar/purchase", { method: "POST", body: JSON.stringify(body) })); }
  it("ignores client prices, student IDs, and claimed ownership", async () => {
    const response = await purchase({ itemId: paperChessSet.id, studentId: "another-student", price: 0, ownsPaper: true });
    expect(response.status).toBe(200);
    expect(mocks.purchaseAvatarItem).toHaveBeenCalledExactlyOnceWith(studentId, paperChessSet.id);
  });
  it("purchases Blossom using the authenticated student and item ID, ignoring the supplied cost", async () => {
    const response = await purchase({ itemId: blossomChessSet.id, studentId: "another-student", price: 1, ownedThemes: ["paper", "blossom"] });
    expect(response.status).toBe(200);
    expect(mocks.purchaseAvatarItem).toHaveBeenCalledExactlyOnceWith(studentId, blossomChessSet.id);
  });
  it.each([null, {}, { itemId: 123 }, { itemId: "paper-chess-set" }])("rejects malformed purchases %j", async (body) => {
    expect((await purchase(body)).status).toBe(400);
    expect(mocks.purchaseAvatarItem).not.toHaveBeenCalled();
  });
  it("requires an active student to spend coins", async () => {
    mocks.requireActiveStudent.mockRejectedValue(new StudentAuthenticationError("Inactive"));
    expect((await purchase({ itemId: paperChessSet.id })).status).toBe(401);
    expect(mocks.purchaseAvatarItem).not.toHaveBeenCalled();
  });
  it.each(["Not enough Academy Coins.", "Item already owned."])("surfaces atomic purchase rejection: %s", async (message) => {
    mocks.purchaseAvatarItem.mockRejectedValue(new Error(message));
    const response = await purchase({ itemId: paperChessSet.id });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: message });
  });
});
