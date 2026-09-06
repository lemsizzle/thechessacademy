import type { LiveGameSnapshot } from "./types";

type SnapshotOrder = Pick<LiveGameSnapshot, "id" | "version" | "serverNow">;
export function isCurrentLiveSnapshot(current: SnapshotOrder | null, incoming: SnapshotOrder) {
  if (!current || current.id !== incoming.id) return true;
  if (incoming.version !== current.version) return incoming.version > current.version;
  return Date.parse(incoming.serverNow) >= Date.parse(current.serverNow);
}

export function liveBoardInput(game: Pick<LiveGameSnapshot, "status" | "activeColor" | "viewer">, pending: boolean, pendingMove: boolean, correspondence: boolean) {
  const active = game.status === "active";
  const canQueuePremove = active && !correspondence && (pendingMove || (!pending && game.activeColor !== game.viewer.color));
  return {
    canQueuePremove,
    interactive: active && (canQueuePremove || (!pending && game.activeColor === game.viewer.color))
  };
}
