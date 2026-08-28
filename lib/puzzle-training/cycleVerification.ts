import type { WoodpeckerCycleOverview } from "@/lib/puzzle-training/overview";

export const WOODPECKER_CYCLE_SAVE_SLOW_NOTICE_MS = 8_000;
export const WOODPECKER_CYCLE_SAVE_TIMEOUT_MS = 60_000;

export type WoodpeckerCycleVerificationInput = {
  readonly sessionId: string;
  readonly setSize: number;
  readonly runId: string;
  readonly cycleNumber: number;
  readonly cycleSessionIds: readonly string[];
};

type WoodpeckerCycleVerificationOptions = {
  fetcher?: typeof fetch;
  onSlow?: () => void;
  slowNoticeMs?: number;
  timeoutMs?: number;
};

export async function requestWoodpeckerCycleVerification(
  input: WoodpeckerCycleVerificationInput,
  options: WoodpeckerCycleVerificationOptions = {}
) {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const slowNoticeTimer = globalThis.setTimeout(
    () => options.onSlow?.(),
    options.slowNoticeMs ?? WOODPECKER_CYCLE_SAVE_SLOW_NOTICE_MS
  );
  const timeoutTimer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? WOODPECKER_CYCLE_SAVE_TIMEOUT_MS);

  try {
    const response = await fetcher("/api/student/puzzle-training/woodpecker-cycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
      signal: controller.signal
    });
    const data = await response.json() as { stats?: WoodpeckerCycleOverview; error?: string };
    if (!response.ok || !data.stats) throw new Error(data.error ?? "Cycle stats could not be saved.");
    return data.stats;
  } catch (error) {
    throw timedOut
      ? new Error("Cycle complete. Verification is taking unusually long. Retry when you are ready.")
      : error;
  } finally {
    globalThis.clearTimeout(slowNoticeTimer);
    globalThis.clearTimeout(timeoutTimer);
  }
}
