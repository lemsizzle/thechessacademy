import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOnlinePlayState } from "@/lib/onlinePlay/client";
import { EMPTY_ONLINE_PLAY } from "@/lib/onlinePlay/types";

afterEach(() => vi.unstubAllGlobals());
const state = { ...EMPTY_ONLINE_PLAY, students: [{ id: "other", name: "Other player", busy: false }] };
const reply = (body: unknown, status = 200) => Response.json(body, { status });

describe("online list and presence refresh", () => {
  it("updates presence and the list with one request", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ result: null, state }));
    vi.stubGlobal("fetch", fetcher);
    const touched = vi.fn();
    expect(await fetchOnlinePlayState(true, touched)).toEqual(state);
    expect(touched).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/student/online-play", expect.objectContaining({
      method: "POST", cache: "no-store", body: JSON.stringify({ action: "heartbeat", includeState: true })
    }));
  });
  it("keeps intermediate invitation polls read-only", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ state }));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchOnlinePlayState()).toEqual(state);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/student/online-play", { cache: "no-store" });
  });
  it("supports older deployed servers without a combined response", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(reply({ result: null })).mockResolvedValueOnce(reply({ state }));
    vi.stubGlobal("fetch", fetcher);
    const touched = vi.fn();
    expect(await fetchOnlinePlayState(true, touched)).toEqual(state);
    expect(touched).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(["network", "http"])("still loads invitations after a %s presence failure", async (failure) => {
    const fetcher = vi.fn();
    if (failure === "network") fetcher.mockRejectedValueOnce(new Error("Network failed"));
    else fetcher.mockResolvedValueOnce(reply({ error: "Presence failed" }, 503));
    fetcher.mockResolvedValueOnce(reply({ state }));
    vi.stubGlobal("fetch", fetcher);
    const touched = vi.fn();
    expect(await fetchOnlinePlayState(true, touched)).toEqual(state);
    expect(touched).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("reports authentication failures instead of reusing stale private data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: "Student log in required." }, 401)));
    await expect(fetchOnlinePlayState()).rejects.toThrow("Student log in required.");
  });
});
