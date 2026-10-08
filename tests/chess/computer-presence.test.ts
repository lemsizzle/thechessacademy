import { afterEach, describe, expect, it, vi } from "vitest";
import { computerGameId, parseComputerPresence, type ComputerPresenceInput } from "@/chess/live/computerPresence";
import { createComputerPresencePublisher } from "@/chess/live/computerPresencePublisher";

const now = Date.parse("2026-10-08T02:00:00Z");
const input: ComputerPresenceInput = {
  gameId: "56be1301-448a-4f10-b211-de23b8387bf5", version: 1, startedAt: new Date(now - 10_000).toISOString(),
  status: "active", botId: "pawny", humanColor: "black", timeControlId: "5+3",
  moves: ["e2e4", "e7e5"], clock: { whiteMs: 299_000, blackMs: 300_000 }, capturedAt: new Date(now).toISOString(), winnerColor: null, resultReason: null
};
afterEach(() => vi.useRealTimers());

describe("private computer game snapshots", () => {
  it("accepts either student color, promotions, and takebacks without client names or reward fields", () => {
    expect(parseComputerPresence(input, now)).toEqual(input);
    expect(parseComputerPresence({ ...input, humanColor: "white", moves: [] }, now).moves).toEqual([]);
    expect(parseComputerPresence({ ...input, moves: ["a7a8q"], coins: 500, opponentName: "fake" }, now).moves).toEqual(["a7a8q"]);
    expect(parseComputerPresence({ ...input, timeControlId: "none", clock: null }, now).clock).toBeNull();
  });
  it.each([
    { gameId: "not-a-uuid" }, { version: 0 }, { botId: "not-a-bot" }, { humanColor: "random" }, { timeControlId: "99" },
    { moves: ["e4"] }, { moves: Array(1201).fill("e2e4") }, { clock: { whiteMs: -1, blackMs: 300_000 } },
    { clock: { whiteMs: 1e12, blackMs: 300_000 } }, { clock: null }, { capturedAt: "invalid" },
    { capturedAt: new Date(now - 121_000).toISOString() }, { startedAt: new Date(now + 90_000).toISOString() },
    { status: "completed", resultReason: null }, { status: "active", winnerColor: "black" }, { resultReason: "checkmate" }
  ])("rejects invalid or stale snapshots (%j)", (changes) => {
    expect(() => parseComputerPresence({ ...input, ...changes }, now)).toThrow("Invalid computer game snapshot");
  });
  it("accepts a completed position and requires an explicit reason", () => {
    expect(parseComputerPresence({ ...input, status: "completed", winnerColor: "white", resultReason: "resignation" }, now).status).toBe("completed");
    expect(computerGameId(`computer-${input.gameId}`)).toBe(input.gameId);
    expect(() => computerGameId(input.gameId)).toThrow();
  });
});

describe("background computer game publishing", () => {
  it("sends the opening immediately, coalesces rapid moves, and does no work for clock ticks", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    let current = { ...input };
    const send = vi.fn().mockResolvedValue(undefined);
    const publisher = createComputerPresencePublisher(() => current, send);
    publisher.schedule();
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    current = { ...current, moves: ["e2e4"] }; publisher.schedule();
    current = { ...current, moves: ["e2e4", "e7e5"] }; publisher.schedule();
    await vi.advanceTimersByTimeAsync(800);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({ version: 2, moves: ["e2e4", "e7e5"] });
    await vi.advanceTimersByTimeAsync(40_000);
    expect(send).toHaveBeenCalledTimes(2);
    publisher.close();
  });
  it("never queues concurrent active writes, and closing uses a newer keepalive version", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    let resolve!: () => void;
    const send = vi.fn().mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; })).mockResolvedValue(undefined);
    const publisher = createComputerPresencePublisher(() => input, send);
    publisher.schedule(); publisher.schedule();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(send).toHaveBeenCalledTimes(1);
    publisher.close(); publisher.close();
    expect(send.mock.calls[1]).toEqual([expect.objectContaining({ status: "closed", version: 2 }), true]);
    resolve(); await vi.advanceTimersByTimeAsync(5_000);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("retries on a later update after a network failure, and retains completion when leaving", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const publisher = createComputerPresencePublisher(() => ({ ...input, status: "completed", winnerColor: "black", resultReason: "checkmate" }), send);
    publisher.schedule(); await vi.advanceTimersByTimeAsync(45_000); publisher.schedule();
    expect(send).toHaveBeenCalledTimes(2);
    publisher.close();
    expect(send.mock.calls[2][0]).toMatchObject({ status: "completed", version: 3, resultReason: "checkmate" });
  });
});
