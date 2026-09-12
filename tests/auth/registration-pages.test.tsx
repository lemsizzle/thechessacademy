import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/ParentStudentLookup", () => ({ ParentStudentLookup: () => null }));
import Home from "@/app/page";
import Register from "@/app/register/page";
import Login from "@/app/login/page";
describe("registration entry points", () => {
  it("leads with Lichess and hides public enrollment on the landing page", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain('href="/login"'); expect(html).toContain("Log in with Academy username");
    expect(html.indexOf("Log in with Lichess")).toBeLessThan(html.indexOf("Log in with Academy username"));
    expect(html).not.toContain("Register with email"); expect(html).not.toContain("Register with Google");
    expect(html).not.toContain("New to Chess Quest?");
  });
  it("shows a nickname and email form with Google registration", async () => {
    const html = renderToStaticMarkup(await Register({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Chess nickname"); expect(html).toContain('type="email"'); expect(html).toContain("Register with Google");
  });
  it("opens email login explicitly while preserving default Academy login", async () => {
    const html = renderToStaticMarkup(await Login({ searchParams: Promise.resolve({ method: "email" }) }));
    expect(html).toContain('type="email"'); expect(html).toContain("Log in with email");
  });
});
