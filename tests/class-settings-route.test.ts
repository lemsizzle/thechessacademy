import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "test-session" }) }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "admin", isValidAdminSession: mocks.authorized }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => mocks }));
import { GET, POST } from "@/app/api/admin/classes/route";

const groups = [{ id: "knights", name: "Knights", outschoolClassUrl: "" }];
function request(body: unknown, origin = "https://chessquest.app") {
  return new Request("https://chessquest.app/api/admin/classes", {
    method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body)
  });
}
describe("server class settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorized.mockReturnValue(true);
    mocks.rpc.mockResolvedValue({ data: { groups, revision: 2 }, error: null });
  });
  it("rejects unauthenticated reads and cross-origin writes before touching data", async () => {
    mocks.authorized.mockReturnValue(false);
    expect((await GET(new Request("https://chessquest.app/api/admin/classes"))).status).toBe(401);
    mocks.authorized.mockReturnValue(true);
    expect((await POST(request({ groups, revision: 1 }, "https://example.com"))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("saves through the atomic revision-checked function", async () => {
    expect((await POST(request({ groups, revision: 1 }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("save_academy_classes", expect.objectContaining({ p_revision: 1, p_import: false, p_backup: null }));
  });
  it("returns a conflict without retrying an obsolete draft", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
    const response = await POST(request({ groups, revision: 1 }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("draft is still here");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("imports all roster classes and archives the original uncorrected settings", async () => {
    mocks.from.mockReturnValue({ select: async () => ({ data: [{ class_group: "Rooks" }, { class_group: "Unassigned" }], error: null }) });
    const original = [{ id: "legacy", name: "", outschoolClassUrl: "old invalid link" }];
    expect((await POST(request({ groups, revision: 0, import: true, backup: original }))).status).toBe(200);
    const input = mocks.rpc.mock.calls[0][1];
    expect(input.p_groups.map((g: { name: string }) => g.name)).toEqual(["Knights", "Rooks"]);
    expect(input.p_backup).toEqual(original);
  });
  it("rejects invalid class links without writing anything", async () => {
    expect((await POST(request({ groups: [{ ...groups[0], outschoolClassUrl: "https://other.example" }], revision: 1 }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
