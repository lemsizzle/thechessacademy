import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  isAuthorizedAdminRequest: vi.fn(),
  fetchLichessGameById: vi.fn(),
  syncTeamTournaments: vi.fn(),
  fetchArenaTournamentResults: vi.fn(),
  importArenaTournament: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth/adminSession", () => ({
  ADMIN_SESSION_COOKIE: "quest_board_admin_session",
  isAuthorizedAdminRequest: mocks.isAuthorizedAdminRequest
}));
vi.mock("@/lib/lichess/fetchLichessGameById", () => ({ fetchLichessGameById: mocks.fetchLichessGameById }));
vi.mock("@/lib/lichess/syncTeamTournaments", () => ({ syncTeamTournaments: mocks.syncTeamTournaments }));
vi.mock("@/lib/lichess/fetchArenaTournamentResults", () => ({ fetchArenaTournamentResults: mocks.fetchArenaTournamentResults }));
vi.mock("@/lib/tournaments/importArenaTournament", () => ({ importArenaTournament: mocks.importArenaTournament }));

import { POST as analyzeGame } from "@/app/api/lichess/game/analyze/route";
import { POST as syncTeamTournaments } from "@/app/api/lichess/team-tournaments/sync/route";
import { POST as syncTournamentResults } from "@/app/api/lichess/tournament-results/sync/route";
import { POST as importTournament } from "@/app/api/lichess/tournaments/import/route";

function request(path: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "x-admin-action-token": "action-token" }
  });
}

describe("teacher-only Lichess route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: "session-cookie" }))
    });
    mocks.isAuthorizedAdminRequest.mockResolvedValue(false);
  });

  it.each([
    {
      name: "game analysis",
      path: "/api/lichess/game/analyze",
      handler: analyzeGame,
      protectedOperation: mocks.fetchLichessGameById
    },
    {
      name: "team tournament sync",
      path: "/api/lichess/team-tournaments/sync",
      handler: syncTeamTournaments,
      protectedOperation: mocks.syncTeamTournaments
    },
    {
      name: "tournament result sync",
      path: "/api/lichess/tournament-results/sync",
      handler: syncTournamentResults,
      protectedOperation: mocks.fetchArenaTournamentResults
    },
    {
      name: "tournament import",
      path: "/api/lichess/tournaments/import",
      handler: importTournament,
      protectedOperation: mocks.importArenaTournament
    }
  ])("rejects unauthorized $name before starting work", async ({ path, handler, protectedOperation }) => {
    const response = await handler(request(path));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Teacher log in required." });
    expect(mocks.isAuthorizedAdminRequest).toHaveBeenCalledWith("session-cookie", "action-token");
    expect(protectedOperation).not.toHaveBeenCalled();
  });
});
