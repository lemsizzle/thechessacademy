import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseServiceClient: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));
vi.mock("server-only", () => ({}));

describe("Supabase client configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and caches the browser client with a publishable key fallback", async () => {
    const client = { kind: "browser-client" };
    mocks.createClient.mockReturnValue(client);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");

    const { getSupabaseClient, isSupabaseConfigured } = await import("@/lib/supabase/client");

    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseClient()).toBe(client);
    expect(getSupabaseClient()).toBe(client);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "sb_publishable_example",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  });

  it("keeps the admin client's explicit configuration errors", async () => {
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    expect(() => getSupabaseAdminClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL is not configured.");

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => getSupabaseAdminClient()).toThrow("SUPABASE_SERVICE_ROLE_KEY is required for admin writes.");
    expect(mocks.getSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("reuses the cached service client for admin operations", async () => {
    const serviceClient = { kind: "service-client" };
    mocks.getSupabaseServiceClient.mockReturnValue(serviceClient);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");

    expect(getSupabaseAdminClient()).toBe(serviceClient);
    expect(mocks.getSupabaseServiceClient).toHaveBeenCalledOnce();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
