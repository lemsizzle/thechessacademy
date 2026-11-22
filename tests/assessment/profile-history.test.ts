import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), student: vi.fn(), db: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/auth/adminSession", () => ({ ADMIN_SESSION_COOKIE: "admin", isAuthorizedAdminRequest: mocks.admin }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.student, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/lib/assessment/server", () => ({ assessmentDb: mocks.db }));
import { GET } from "@/app/api/student/assessment/history/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
const own = "30000000-0000-4000-8000-000000000001", other = "30000000-0000-4000-8000-000000000002";
const request = (query = "") => new NextRequest(`http://localhost/api/student/assessment/history${query}`);
describe("private profile test history", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue(false); mocks.student.mockResolvedValue({studentId:own}); });
  it("blocks anonymous and other-student reads before touching test storage", async () => {
    mocks.student.mockRejectedValueOnce(new StudentAuthenticationError("login"));
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request(`?studentId=${other}`))).status).toBe(403);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("returns only completed-score summaries, with pagination and viewer-specific links", async () => {
    const query = {from:vi.fn(),select:vi.fn(),eq:vi.fn(),gte:vi.fn(),order:vi.fn(),range:vi.fn()};
    for (const method of [query.from,query.select,query.eq,query.gte,query.order]) method.mockReturnValue(query);
    query.range.mockResolvedValue({data:Array.from({length:11},(_,i)=>({id:String(i),version:"skills-b-v1",started_at:"date",completed_at:"date",correct_count:24,answers:{b01:"secret"},student_id:own})),error:null});
    mocks.db.mockReturnValue(query);
    const response = await GET(request("?page=2")), data = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(query.eq).toHaveBeenCalledWith("student_id",own);expect(query.gte).toHaveBeenCalledWith("correct_count",0);expect(query.range).toHaveBeenCalledWith(10,20);
    expect(data.results).toHaveLength(10);expect(data.hasMore).toBe(true);expect(data.reviewBase).toBe("/student/training/assessment");
    expect(data.results[0]).not.toHaveProperty("answers");expect(data.results[0]).not.toHaveProperty("student_id");
    mocks.admin.mockResolvedValue(true);
    expect((await (await GET(request(`?studentId=${other}`))).json()).reviewBase).toBe("/admin/assessments");
    expect(query.eq).toHaveBeenCalledWith("student_id",other);
  });
  it("rejects bad pagination and distinguishes failed loads from empty results", async () => {
    expect((await GET(request("?page=-1"))).status).toBe(400);
    mocks.db.mockImplementation(()=>{throw new Error("offline")});
    const response = await GET(request());expect(response.status).toBe(503);expect((await response.json()).error).toContain("retry");
  });
});
