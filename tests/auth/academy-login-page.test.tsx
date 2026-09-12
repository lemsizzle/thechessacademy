import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/student/LichessLoginButton", () => ({ LichessLoginButton: () => <a href="/api/auth/lichess/start">Log in with Lichess</a> }));
import LoginPage from "@/app/login/page";
describe("dual student login page", () => {
  it("renders Academy credentials and Lichess without an automatic redirect", async () => {
    const markup = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain("Academy username"); expect(markup).toContain('type="password"');
    expect(markup).toContain("Log in with Lichess"); expect(markup).toContain('/api/auth/lichess/start');
  });
  it("preserves the Teacher view", async () => { expect(renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ mode: "admin" }) }))).toContain("Teacher Log In"); });
});
