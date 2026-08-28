import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestWoodpeckerCycleVerification,
  WOODPECKER_CYCLE_SAVE_SLOW_NOTICE_MS,
  WOODPECKER_CYCLE_SAVE_TIMEOUT_MS,
  type WoodpeckerCycleVerificationInput
} from "@/lib/puzzle-training/cycleVerification";

const input: WoodpeckerCycleVerificationInput = {
  sessionId: "11111111-1111-4111-8111-111111111111",
  setSize: 20,
  runId: "22222222-2222-4222-8222-222222222222",
  cycleNumber: 1,
  cycleSessionIds: ["11111111-1111-4111-8111-111111111111"]
};

const stats = {
  puzzlesPerMinute: 10,
  accuracy: 95,
  setSize: 20,
  theme: "mixed" as const,
  completedAt: "2026-08-28T12:00:00.000Z"
};

function successfulResponse() {
  return new Response(JSON.stringify({ stats }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Woodpecker cycle verification timing", () => {
  it("shows a soft delay notice long before aborting a genuinely stuck request", () => {
    expect(WOODPECKER_CYCLE_SAVE_SLOW_NOTICE_MS).toBe(8_000);
    expect(WOODPECKER_CYCLE_SAVE_TIMEOUT_MS).toBeGreaterThanOrEqual(45_000);
    expect(WOODPECKER_CYCLE_SAVE_TIMEOUT_MS).toBeGreaterThan(WOODPECKER_CYCLE_SAVE_SLOW_NOTICE_MS);
  });

  it("keeps the request alive after eight seconds and accepts a delayed success", async () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    const request = { signal: undefined as AbortSignal | undefined };
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      request.signal = init?.signal as AbortSignal;
      return new Promise<Response>((resolve) => {
        setTimeout(() => resolve(successfulResponse()), 12_000);
      });
    }) as unknown as typeof fetch;

    const verification = requestWoodpeckerCycleVerification(input, { fetcher, onSlow });
    await vi.advanceTimersByTimeAsync(8_000);

    expect(onSlow).toHaveBeenCalledOnce();
    expect(request.signal?.aborted).toBe(false);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/student/puzzle-training/woodpecker-cycle",
      expect.objectContaining({ keepalive: true, body: JSON.stringify(input) })
    );

    await vi.advanceTimersByTimeAsync(4_000);
    await expect(verification).resolves.toEqual(stats);
    expect(request.signal?.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts only after the hard timeout and reports a retryable failure", async () => {
    vi.useFakeTimers();
    const request = { signal: undefined as AbortSignal | undefined };
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      request.signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        request.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    }) as unknown as typeof fetch;

    const verification = requestWoodpeckerCycleVerification(input, { fetcher });
    const rejection = expect(verification).rejects.toThrow("Verification is taking unusually long");
    await vi.advanceTimersByTimeAsync(WOODPECKER_CYCLE_SAVE_TIMEOUT_MS - 1);
    expect(request.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(request.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
