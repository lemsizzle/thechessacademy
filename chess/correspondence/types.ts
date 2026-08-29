import type { StudentAvatarConfig } from "@/lib/types";
import type { LiveGameSummary } from "@/chess/live/types";

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
  acceptedGameId: string | null;
};

export type CorrespondenceInbox = {
  incoming: CorrespondenceChallenge[];
  outgoing: CorrespondenceChallenge[];
  activeGames: LiveGameSummary[];
  unreadCount: number;
  realtimeTopic: string;
};

export type CorrespondenceChallengeAction = "accept" | "reject" | "cancel";
