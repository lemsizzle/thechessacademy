import type { TimeControl } from "@/chess/types";
import type { AvatarItem, StudentAvatarConfig } from "@/lib/types";

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
  avatar?: StudentAvatarConfig;
};

export type InternalArenaPairing = {
  id: string;
  gameId: string;
  status: "active" | "completed";
  result: "white_win" | "black_win" | "draw" | null;
  whiteStudentId: string;
  whiteName: string;
  blackStudentId: string;
  blackName: string;
  whitePoints: number;
  blackPoints: number;
  startedAt: string;
  completedAt: string | null;
};

export type InternalArenaChatMessage = {
  id: string;
  studentId: string | null;
  senderRole: "student" | "teacher";
  senderName: string;
  message: string;
  createdAt: string;
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

export type InternalArenaLobby = {
  arena: InternalArena;
  pairings: InternalArenaPairing[];
  messages: InternalArenaChatMessage[];
  avatarItems: AvatarItem[];
  canChat: boolean;
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
