import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ authenticate: vi.fn(), allowed: true }));
vi.mock("@/lib/auth/studentCredentials", () => ({ authenticateAcademyStudent: mock.authenticate }));
vi.mock("@/lib/auth/academyLoginThrottle", () => ({ allowAcademyLoginAttempt: () => mock.allowed }));
import { POST } from "@/app/api/auth/student/login/route";
import { readStudentSession } from "@/lib/auth/session";
import { STUDENT_APP_SESSION_COOKIE } from "@/lib/auth/roles";
const request = (body: unknown, origin = "https://academy.test") => new Request("https://academy.test/api/auth/student/login", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
describe("Academy login endpoint", () => {
  beforeEach(() => { mock.authenticate.mockReset(); mock.allowed = true; });
  it("sets the existing signed HTTP-only cookie", async () => {
    mock.authenticate.mockResolvedValue({ studentId: "11111111-1111-4111-8111-111111111111", displayName: "Learner", username: "learner" });
    const response = await POST(request({ username: "learner", password: "sample-password" }));
    expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const session = readStudentSession({ get: () => response.cookies.get(STUDENT_APP_SESSION_COOKIE) });
    expect(session).toMatchObject({ authProvider: "academy", academyUsername: "learner", onboardingCompleted: true });
    expect(session?.lichessUserId).toBeUndefined();
    expect(JSON.stringify(await response.json())).not.toContain("password");
  });
  it("returns generic credential failures", async () => { mock.authenticate.mockResolvedValue(null); const r = await POST(request({ username: "learner", password: "wrong" })); expect(r.status).toBe(401); expect(await r.json()).toEqual({ error: "Invalid username or password." }); });
  it.each([null, {}, { username: 42, password: [] }])("rejects malformed input", async (body) => { expect((await POST(request(body))).status).toBe(401); expect(mock.authenticate).not.toHaveBeenCalled(); });
  it("rejects cross-origin login", async () => expect((await POST(request({}, "https://evil.test"))).status).toBe(403));
  it("uses the incoming host when Next normalizes the internal URL", async () => {
    mock.authenticate.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost:3013/api/auth/student/login", { method: "POST", headers: { host: "127.0.0.1:3013", origin: "http://127.0.0.1:3013" }, body: JSON.stringify({ username: "learner", password: "wrong" }) }));
    expect(response.status).toBe(401);
    expect(mock.authenticate).toHaveBeenCalled();
  });
  it("limits repeated attempts before password hashing", async () => { mock.allowed = false; expect((await POST(request({}))).status).toBe(429); expect(mock.authenticate).not.toHaveBeenCalled(); });
  it("does not reveal server errors", async () => { mock.authenticate.mockRejectedValue(new Error("private DB detail")); const r = await POST(request({ username: "learner", password: "password" })); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("private"); });
});
