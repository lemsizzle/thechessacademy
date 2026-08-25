import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdminActionToken, createAdminSessionValue, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

describe("teacher request authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts the secure session cookie", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "teacher-test-secret");
    expect(await isAuthorizedAdminRequest(await createAdminSessionValue(), null)).toBe(true);
  });

  it("accepts the server-issued action token when the cookie is unavailable", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "teacher-test-secret");
    expect(await isAuthorizedAdminRequest(null, await createAdminActionToken())).toBe(true);
  });

  it("rejects requests without either valid teacher credential", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "teacher-test-secret");
    expect(await isAuthorizedAdminRequest("invalid-session", "invalid-token")).toBe(false);
  });
});
