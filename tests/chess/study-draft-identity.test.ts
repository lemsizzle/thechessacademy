import { beforeEach, expect, it, vi } from "vitest";
const { actor, getStudy } = vi.hoisted(() => ({ actor: vi.fn(), getStudy: vi.fn() }));
vi.mock("@/lib/auth/requireChessActor", () => ({ requireChessActor: actor }));
vi.mock("@/chess/persistence/studyServer", () => ({ getStudy, updateStudy: vi.fn(), deleteStudy: vi.fn() }));
import { GET } from "@/app/api/chess/studies/[studyId]/route";
const request = () => new Request("http://localhost/api/chess/studies/s?draftOwnerKey=student:someone-else", { headers: { "x-student-id": "someone-else" } });
beforeEach(() => { vi.clearAllMocks(); getStudy.mockResolvedValue({ study: { id: "s" }, chapters: [] }); });
it("scopes drafts to the verified student, ignoring client identity hints", async () => {
  actor.mockResolvedValue({ kind: "student", studentId: "verified-student", name: "QA" });
  const response = await GET(request(), { params: Promise.resolve({ studyId: "s" }) });
  expect((await response.json()).draftOwnerKey).toBe("student:verified-student");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(getStudy).toHaveBeenCalledWith({ kind: "student", studentId: "verified-student", name: "QA" }, "s");
});
it("keeps teacher recovery separate from student recovery", async () => {
  actor.mockResolvedValue({ kind: "admin" });
  const response = await GET(request(), { params: Promise.resolve({ studyId: "s" }) });
  expect((await response.json()).draftOwnerKey).toBe("admin");
});
it("never returns recovery identity or content when access is denied", async () => {
  actor.mockResolvedValue({ kind: "student", studentId: "other", name: "QA" });
  getStudy.mockRejectedValue(new Error("You do not have permission to access this study."));
  const response = await GET(request(), { params: Promise.resolve({ studyId: "s" }) });
  expect(response.status).toBe(403);
  expect(await response.json()).not.toHaveProperty("draftOwnerKey");
});
