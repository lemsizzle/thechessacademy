import { afterEach, describe, expect, it, vi } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import config from "../../next.config";
import { getLichessRedirectUri } from "../../lib/auth/lichessOAuth";

afterEach(() => vi.unstubAllEnvs());

describe("canonical Chess Quest domain", () => {
  it.each(["/", "/student/training?mode=survival", "/admin/students", "/app/students/player-one", "/register"])("preserves the path and query of %s", async (path) => {
    const response = await unstable_getResponseFromNextConfig({ url: `https://thechessacademy.vercel.app${path}`, nextConfig: config });
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`https://chessquest.app${path}`);
  });
  it.each(["lichess", "google"])("starts %s on the canonical host before cookies are issued", async (provider) => {
    const path = `/api/auth/${provider}/start?returnTo=%2Fstudent`;
    const response = await unstable_getResponseFromNextConfig({ url: `https://thechessacademy.vercel.app${path}`, nextConfig: config });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://chessquest.app${path}`);
  });
  it.each(["https://chessquest.app/student", "https://preview-example.vercel.app/student", "https://thechessacademy.vercel.app/api/auth/lichess/callback?code=test", "https://thechessacademy.vercel.app/api/student/profile"])("does not intercept %s", async (url) => {
    const response = await unstable_getResponseFromNextConfig({ url, nextConfig: config });
    expect(response.headers.get("location")).toBeNull();
  });
  it("overrides obsolete production OAuth environment URLs on chessquest.app", () => {
    vi.stubEnv("LICHESS_REDIRECT_URI", "https://thechessacademy.vercel.app/api/auth/lichess/callback");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://thechessacademy.vercel.app");
    expect(getLichessRedirectUri("https://chessquest.app")).toBe("https://chessquest.app/api/auth/lichess/callback");
  });
});
