import type { TimeControl } from "@/chess/types";

export type InternalArenaStatus = "scheduled" | "active" | "finished" | "cancelled";
export type InternalArenaEntryStatus = "joined" | "waiting" | "playing" | "withdrawn" | "finished";

export type InternalArenaStanding = {
  studentId: string;
  name: string;
  status: InternalArenaEntryStatus;
  score: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  currentGameId: string | null;
  rank: number;
};

export type InternalArena = {
  id: string;
  name: string;
  description: string;
  status: InternalArenaStatus;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  timeControlId: string;
  timeControl: TimeControl;
  rated: boolean;
  classGroup: string | null;
  standings: InternalArenaStanding[];
  entry: InternalArenaStanding | null;
  createdAt: string;
  updatedAt: string;
};

export type InternalArenaMatchmaking = {
  status: "joined" | "waiting" | "matched";
  gameId: string | null;
};

export type CreateInternalArenaInput = {
  name: string;
  description?: string;
  startsAt?: string;
  durationMinutes: number;
  timeControlId: string;
  rated?: boolean;
  classGroup?: string;
};
