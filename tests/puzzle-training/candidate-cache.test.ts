import { afterEach, expect, it, vi } from "vitest";
import { createCandidateCache } from "@/lib/puzzle-training/candidateCache";
afterEach(() => vi.useRealTimers());
it("shares concurrent pools and refreshes expired data", async () => {
  vi.useFakeTimers();
  const cache = createCandidateCache<number>(100);
  const load = vi.fn().mockResolvedValue([1, 2]);
  expect(await Promise.all([cache("fork:easy", load), cache("fork:easy", load)])).toEqual([[1,2],[1,2]]);
  expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(101);
  await cache("fork:easy", load);
  expect(load).toHaveBeenCalledTimes(2);
});
it("does not poison retries with failures or empty pools and bounds memory", async () => {
  const cache = createCandidateCache<number>(1000, 1);
  await expect(cache("a", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  expect(await cache("a", async () => [])).toEqual([]);
  expect(await cache("a", async () => [1])).toEqual([1]);
  await cache("b", async () => [2]);
  expect(await cache("a", async () => [3])).toEqual([3]);
});
