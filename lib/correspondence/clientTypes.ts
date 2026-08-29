import type { ChessColor } from "@/chess/types";
import type { StudentAvatarConfig } from "@/lib/types";

export type CorrespondenceChallengeStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired";

export type CorrespondenceParty = {
  id: string;
  name: string;
  slug?: string;
  avatar?: StudentAvatarConfig;
};

export type CorrespondenceChallenge = {
  id: string;
  status: CorrespondenceChallengeStatus;
  createdAt: string;
  expiresAt: string;
  seenAt?: string | null;
  challenger: CorrespondenceParty;
  recipient: CorrespondenceParty;
  acceptedGameId?: string | null;
};

export type CorrespondenceGameSummary = {
  id: string;
  opponent: CorrespondenceParty | null;
  viewerColor: ChessColor;
  activeColor: ChessColor;
  status: "active" | "completed" | "cancelled";
  turnDeadlineAt: string | null;
  updatedAt: string;
  gameMode: "correspondence";
};

export type CorrespondenceInbox = {
  incoming: CorrespondenceChallenge[];
  outgoing: CorrespondenceChallenge[];
  activeGames: CorrespondenceGameSummary[];
  unreadCount: number;
  realtimeTopic: string | null;
};

export const EMPTY_CORRESPONDENCE_INBOX: CorrespondenceInbox = {
  incoming: [],
  outgoing: [],
  activeGames: [],
  unreadCount: 0,
  realtimeTopic: null
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

/** Keep the UI compatible with the final nested response and early flat API previews. */
export function readCorrespondenceInbox(value: unknown): CorrespondenceInbox {
  const response = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const nested = response.inbox && typeof response.inbox === "object"
    ? response.inbox as Record<string, unknown>
    : response;
  return {
    incoming: asArray<CorrespondenceChallenge>(nested.incoming),
    outgoing: asArray<CorrespondenceChallenge>(nested.outgoing),
    activeGames: asArray<CorrespondenceGameSummary>(nested.activeGames),
    unreadCount: Number.isFinite(Number(nested.unreadCount)) ? Math.max(0, Number(nested.unreadCount)) : 0,
    realtimeTopic: typeof nested.realtimeTopic === "string" && nested.realtimeTopic ? nested.realtimeTopic : null
  };
}

export function formatCorrespondenceTimeLeft(deadline: string | null, nowMs = Date.now()) {
  if (!deadline) return "No deadline";
  const remainingMs = new Date(deadline).getTime() - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Time expired";
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
