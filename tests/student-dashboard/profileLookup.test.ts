import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerReadClient: mocks.client }));
import { lookupPublicStudent } from "@/app/actions/studentProfileLookup";

beforeEach(() => vi.clearAllMocks());

function queryFor(results: unknown[]) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), ilike: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
  for (const result of results) query.maybeSingle.mockResolvedValueOnce(result);
  mocks.client.mockReturnValue({ from: () => query });
  return query;
}

it("looks up an exact active profile slug without exposing a roster", async () => {
  const query = queryFor([{ data: { public_slug: "master-chief117" }, error: null }]);
  expect(await lookupPublicStudent(" @Master-Chief117 ")).toEqual({ slug: "master-chief117" });
  expect(query.eq).toHaveBeenCalledWith("is_active", true);
  expect(query.eq).toHaveBeenCalledWith("public_slug", "master-chief117");
  expect(query.select).toHaveBeenCalledWith("public_slug");
  expect(query.ilike).not.toHaveBeenCalled();
});

it("matches usernames case-insensitively with literal underscores", async () => {
  const query = queryFor([{ data: null, error: null }, { data: { public_slug: "student-profile" }, error: null }]);
  expect(await lookupPublicStudent("Chess_Player")).toEqual({ slug: "student-profile" });
  expect(query.ilike).toHaveBeenCalledWith("lichess_username", "chess\\_player");
});

it("rejects wildcard searches before querying", async () => {
  expect((await lookupPublicStudent("%")).error).toBeTruthy();
  expect(mocks.client).not.toHaveBeenCalled();
});

it("does not substitute sample students or disclose database errors", async () => {
  queryFor([{ data: null, error: null }, { data: null, error: null }]);
  expect((await lookupPublicStudent("missing")).error).toContain("No student profile");
  queryFor([{ data: null, error: { message: "internal database details" } }]);
  expect((await lookupPublicStudent("missing")).error).not.toContain("internal database details");
});
