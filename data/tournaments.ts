import type { Tournament } from "@/lib/types";

const now = Date.now();

export const mockTournaments: Tournament[] = [
  {
    id: "mock-arena-weekly",
    lichessId: "mock-arena-weekly",
    name: "Outschool Battleground Weekly Arena",
    description: "Mock fallback tournament for local testing.",
    status: "upcoming",
    startsAt: new Date(now + 1000 * 60 * 60 * 24 * 3).toISOString(),
    durationMinutes: 60,
    url: "https://lichess.org/team/outschool-battleground",
    teamId: "outschool-battleground",
    createdBy: "Chess Academy",
    rated: false,
    variant: "standard",
    speed: "rapid",
    timeControl: "10+0",
    playerCount: 0,
    source: "team_sync",
    isPublic: true,
    syncedAt: new Date().toISOString()
  },
  {
    id: "mock-arena-finished",
    lichessId: "mock-arena-finished",
    name: "Chess Academy Friday Arena",
    description: "Finished mock Arena used to test results and XP approval.",
    status: "finished",
    startsAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
    endsAt: new Date(now - 1000 * 60 * 60 * 24 * 3 + 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    url: "https://lichess.org/tournament/mock-arena-finished",
    teamId: "outschool-battleground",
    createdBy: "Chess Academy",
    rated: true,
    variant: "standard",
    speed: "blitz",
    timeControl: "5+3",
    playerCount: 18,
    source: "team_sync",
    isPublic: true,
    syncedAt: new Date().toISOString()
  }
];
