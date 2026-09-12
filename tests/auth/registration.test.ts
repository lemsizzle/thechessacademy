import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signIn: vi.fn(), session: vi.fn(), oauth: vi.fn(), exchange: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/auth/registration", () => ({
  sameOriginRequest: (r: Request) => r.headers.get("origin") === "https://chessquest.app",
  registrationOrigin: () => "https://chessquest.app",
  registrationClient: async () => ({ client: { auth: { signUp: mocks.signUp, signInWithPassword: mocks.signIn, signInWithOAuth: mocks.oauth, exchangeCodeForSession: mocks.exchange, getUser: mocks.getUser } }, applyCookies: (r: NextResponse) => r }),
  registeredStudentSession: mocks.session
}));
vi.mock("@/lib/auth/academyLoginThrottle", () => ({ allowAcademyLoginAttempt: () => true }));
import { POST } from "@/app/api/auth/email/route";
import { GET as google } from "@/app/api/auth/google/start/route";
import { GET as callback } from "@/app/api/auth/registration/callback/route";
const request = (body: unknown) => new Request("https://chessquest.app/api/auth/email", { method: "POST", headers: { origin: "https://chessquest.app" }, body: JSON.stringify(body) });
const registration = { action: "register", email: " Learner@example.com ", password: "sample-password", nickname: "Knight" };
describe("email and Google registration", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.session.mockImplementation(async (_user, response) => response); });
  it("requests email confirmation without creating an application session", async () => {
    mocks.signUp.mockResolvedValue({ data: { user: {}, session: null }, error: null });
    const response = await POST(request(registration));
    expect((await response.json()).confirmationRequired).toBe(true);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: "learner@example.com", options: { data: { nickname: "Knight" }, emailRedirectTo: "https://chessquest.app/api/auth/registration/callback" } }));
  });
  it.each([{ ...registration, password: "short" }, { ...registration, nickname: "" }, { ...registration, email: "bad" }, null])("rejects invalid registration details", async body => { expect((await POST(request(body))).status).toBe(400); expect(mocks.signUp).not.toHaveBeenCalled(); });
  it("rejects cross-site password submissions", async () => { expect((await POST(new Request("https://chessquest.app/api/auth/email", { method: "POST", body: "{}" }))).status).toBe(403); });
  it("does not admit unconfirmed email users", async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { email_confirmed_at: null } }, error: null });
    expect((await POST(request({ ...registration, action: "login" }))).status).toBe(401);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("exchanges confirmed email identity for the existing app session", async () => {
    const user = { id: "auth-id", email_confirmed_at: "2026-01-01" };
    mocks.signIn.mockResolvedValue({ data: { user }, error: null });
    expect((await POST(request({ ...registration, action: "login" }))).status).toBe(200);
    expect(mocks.session).toHaveBeenCalledWith(user, expect.anything());
  });
  it("starts Google with a fixed callback and server-side PKCE", async () => {
    mocks.oauth.mockResolvedValue({ data: { url: "https://project.supabase.co/auth/v1/authorize" }, error: null });
    expect((await google(new Request("https://chessquest.app/api/auth/google/start"))).status).toBe(307);
    expect(mocks.oauth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", options: expect.objectContaining({ redirectTo: "https://chessquest.app/api/auth/registration/callback", skipBrowserRedirect: true }) }));
  });
  it("rejects invalid callback codes without provisioning", async () => {
    mocks.exchange.mockResolvedValue({ data: {}, error: new Error("invalid") });
    expect((await callback(new Request("https://chessquest.app/api/auth/registration/callback?code=bad"))).headers.get("location")).toContain("error=confirmation");
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("uses a verified user from Supabase rather than URL identity claims", async () => {
    const user = { id: "verified-user" };
    mocks.exchange.mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    const response = await callback(new Request("https://chessquest.app/api/auth/registration/callback?code=valid&studentId=other"));
    expect(response.headers.get("location")).toBe("https://chessquest.app/student");
    expect(mocks.session).toHaveBeenCalledWith(user, expect.anything());
  });
});
