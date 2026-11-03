import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  state: vi.fn(),
  admin: vi.fn(),
  token: vi.fn(),
  filters: [] as unknown[],
}));
vi.mock("@/lib/auth/requireActiveStudent", () => ({
  requireActiveStudent: mocks.auth,
  StudentAuthenticationError: class extends Error {},
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({
  getStudentAvatarState: mocks.state,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/auth/adminSession", () => ({
  ADMIN_SESSION_COOKIE: "admin",
  isValidAdminSession: mocks.admin,
  isValidAdminActionToken: mocks.token,
}));
import { GET, POST } from "@/app/api/student/avatar/rewards/route";
import { GET as adminGET, PATCH } from "@/app/api/admin/store-rewards/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
const requestId = "4cf743a4-bf48-4de1-8583-2a1c7a5d7cb0";
const request = (body: unknown, method = "POST") =>
  new Request("http://localhost/rewards", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.filters = [];
  mocks.auth.mockResolvedValue({ studentId: "trusted-student" });
  mocks.state.mockResolvedValue({ configured: true, source: "supabase" });
  mocks.rpc.mockResolvedValue({ data: { id: requestId }, error: null });
  mocks.admin.mockResolvedValue(false);
  mocks.token.mockResolvedValue(false);
  mocks.from.mockImplementation(() => {
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        mocks.filters.push(args);
        return query;
      },
      order: () => query,
      limit: () => query,
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null, count: 123 }).then(resolve),
    };
    return query;
  });
});
it("requires active student authentication before any read or spend", async () => {
  mocks.auth.mockRejectedValue(new StudentAuthenticationError("Log in"));
  expect((await GET()).status).toBe(401);
  expect((await POST(request({ kind: "free_class", requestId }))).status).toBe(
    401,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("reads only the signed-in student's rewards and returns the exact stack count", async () => {
  const result = await GET();
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(await result.json()).toMatchObject({ availableCouponCount: 123 });
  expect(mocks.filters.filter((f: any) => f[0] === "student_id")).toEqual([
    ["student_id", "trusted-student"],
    ["student_id", "trusted-student"],
  ]);
});
it("ignores client identity, price and prize and preserves the retry reference", async () => {
  expect(
    (
      await POST(
        request({
          kind: "mystery_box",
          requestId,
          studentId: "victim",
          price: 0,
          itemId: "expensive",
        }),
      )
    ).status,
  ).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("purchase_store_reward", {
    p_student_id: "trusted-student",
    p_kind: "mystery_box",
    p_request_id: requestId,
  });
});
it("validates requests and refuses fallback wallets", async () => {
  expect(
    (await POST(request({ kind: "mystery_box", requestId: "invalid" }))).status,
  ).toBe(400);
  mocks.state.mockResolvedValue({ configured: true, source: "seed" });
  expect((await POST(request({ kind: "free_class", requestId }))).status).toBe(
    503,
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("keeps ambiguous failures retryable without exposing database details", async () => {
  mocks.rpc.mockResolvedValue({
    error: { code: "08006", message: "private database details" },
  });
  const result = await POST(request({ kind: "free_class", requestId }));
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("private database details");
});
it("returns the saved reward even if refreshing the wallet fails", async () => {
  mocks.state
    .mockResolvedValueOnce({ configured: true, source: "supabase" })
    .mockResolvedValueOnce({ configured: true, source: "seed" });
  expect(
    await (await POST(request({ kind: "free_class", requestId }))).json(),
  ).toEqual({ receipt: { id: requestId }, state: null });
});
it("students cannot read teacher requests or redeem/refund coupons", async () => {
  expect((await adminGET(new Request("http://localhost/rewards"))).status).toBe(
    401,
  );
  expect(
    (await PATCH(request({ id: requestId, status: "refunded" }, "PATCH")))
      .status,
  ).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
});
it("teacher resolution validates action and uses one receipt at a time", async () => {
  mocks.admin.mockResolvedValue(true);
  expect(
    (await PATCH(request({ id: requestId, status: "awarded" }, "PATCH")))
      .status,
  ).toBe(400);
  expect(
    (await PATCH(request({ id: requestId, status: "fulfilled" }, "PATCH")))
      .status,
  ).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
    "resolve_free_class_reward",
    { p_receipt_id: requestId, p_resolution: "fulfilled" },
  );
});
it("teacher requests include coupons won from boxes", async () => {
  mocks.admin.mockResolvedValue(true);
  expect((await adminGET(new Request("http://localhost/rewards"))).status).toBe(
    200,
  );
  expect(mocks.filters).toContainEqual(["prize_kind", "free_class"]);
  expect(mocks.filters).not.toContainEqual(["kind", "free_class"]);
});
