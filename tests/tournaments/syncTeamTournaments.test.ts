import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fetchTeam = vi.hoisted(() => vi.fn());
vi.mock("@/lib/lichess/fetchTeamArenaTournaments", () => ({ fetchTeamArenaTournaments: fetchTeam }));
beforeEach(() => { vi.resetModules(); fetchTeam.mockReset(); vi.stubEnv("LICHESS_TEAM_ID", "academy-test"); });
afterEach(() => vi.unstubAllEnvs());

it("shares concurrent cache misses and forced refreshes, without delaying later forced syncs", async () => {
  const { syncTeamTournaments } = await import("@/lib/lichess/syncTeamTournaments");
  let resolve!: (value: unknown[]) => void;
  fetchTeam.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const first = syncTeamTournaments();
  const second = syncTeamTournaments();
  const forced = syncTeamTournaments({ force: true });
  expect(fetchTeam).toHaveBeenCalledExactlyOnceWith("academy-test");
  resolve([]);
  const results = await Promise.all([first, second, forced]);
  expect(results[0].mode).toBe("connected");
  expect(results[1]).toBe(results[0]);
  expect(results[2]).toBe(results[0]);
  expect(await syncTeamTournaments()).toBe(results[0]);
  expect(fetchTeam).toHaveBeenCalledOnce();
  fetchTeam.mockResolvedValueOnce([]);
  await syncTeamTournaments({ force: true });
  expect(fetchTeam).toHaveBeenCalledTimes(2);
});

it("clears failed refreshes so manual retry can recover", async () => {
  const { syncTeamTournaments } = await import("@/lib/lichess/syncTeamTournaments");
  fetchTeam.mockRejectedValueOnce(new Error("Rate limited"));
  const [first, second] = await Promise.all([syncTeamTournaments(), syncTeamTournaments()]);
  expect(first.mode).toBe("mock");
  expect(second).toBe(first);
  expect(fetchTeam).toHaveBeenCalledOnce();
  fetchTeam.mockResolvedValueOnce([]);
  expect((await syncTeamTournaments({ force: true })).mode).toBe("connected");
  expect(fetchTeam).toHaveBeenCalledTimes(2);
});
