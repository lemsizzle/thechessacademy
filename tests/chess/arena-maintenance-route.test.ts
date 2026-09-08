import { afterEach, expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("@/chess/persistence/arenaServer", () => ({ maintainInternalArenas: run }));
import { POST } from "@/app/api/cron/internal-arenas/route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("fails closed when the maintenance secret is missing or wrong", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await POST(new Request("http://localhost"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "test-secret");
  expect((await POST(new Request("http://localhost", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  expect(run).not.toHaveBeenCalled();
});
it("runs authenticated maintenance and returns a retryable failure without leaking details", async () => {
  vi.stubEnv("CRON_SECRET", "test-secret"); run.mockResolvedValueOnce({ checked: 2 });
  const request = () => new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } });
  expect(await (await POST(request())).json()).toEqual({ ok: true, checked: 2 });
  run.mockRejectedValueOnce(new Error("database details"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await POST(request()); expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("database details"); log.mockRestore();
});
