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

export type CorrespondenceAlert = {
  key: string;
  title: string;
  message: string;
  href: string;
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

export function correspondenceAlerts(inbox: CorrespondenceInbox, currentPathname: string): CorrespondenceAlert[] {
  const challengeAlerts = inbox.incoming
    .filter((challenge) => challenge.status === "pending" && !challenge.seenAt)
    .map((challenge) => ({
      key: challenge.id,
      title: "Incoming chess challenge",
      message: `${challenge.challenger.name} challenged you to a correspondence game.`,
      href: "/student/play/correspondence"
    }));
  const moveAlerts = inbox.activeGames
    .filter((game) => game.status === "active" && game.activeColor === game.viewerColor)
    .map((game) => ({
      key: `turn:${game.id}:${game.updatedAt}`,
      title: "Your move",
      message: `Your correspondence game${game.opponent?.name ? ` against ${game.opponent.name}` : ""} is ready.`,
      href: `/student/play/correspondence/${encodeURIComponent(game.id)}`
    }))
    .filter((alert) => alert.href !== currentPathname);
  return [...challengeAlerts, ...moveAlerts];
}

function sortableTimestamp(value: string | null, fallback: number) {
  if (!value) return fallback;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

/** Pick the most urgent different correspondence game that currently needs the student's move. */
export function nextCorrespondenceGameToMove(
  games: CorrespondenceGameSummary[],
  currentGameId: string
) {
  return games
    .filter((game) => (
      game.id !== currentGameId
      && game.status === "active"
      && game.activeColor === game.viewerColor
    ))
    .sort((left, right) => {
      const deadlineDifference = sortableTimestamp(left.turnDeadlineAt, Number.POSITIVE_INFINITY)
        - sortableTimestamp(right.turnDeadlineAt, Number.POSITIVE_INFINITY);
      if (deadlineDifference !== 0) return deadlineDifference;
      return sortableTimestamp(left.updatedAt, 0) - sortableTimestamp(right.updatedAt, 0);
    })[0] ?? null;
}
