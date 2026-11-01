import type { BattleAction, BattleView } from "./types";

type BattleReply = { battle: BattleView };
type RequestBattle = (url: string, body?: unknown, timeoutMs?: number) => Promise<BattleReply>;
const recoverable = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  return !status || status >= 500;
};

function acknowledged(reply: BattleReply, action: BattleAction) {
  const me = reply.battle.state.players.find(p => p.id === reply.battle.me);
  return me?.lastAction === action.actionId ||
    (action.revision !== undefined && me !== undefined && me.revision > action.revision) ||
    ["finished", "cancelled"].includes(reply.battle.state.status);
}

/** A dropped response must not leave the board locked behind a manual retry.
 * Reconcile first, then replay the SAME action at most once. Personal revisions
 * and action IDs make a retry safe even when the first request saved successfully.
 * An HTTP 200 alone is not acknowledgement: a revision conflict may return the
 * unchanged room. Healthy moves keep the existing single-request path.
 */
export async function submitBattleWithRecovery(
  url: string, action: BattleAction, request: RequestBattle, recovering: () => void,
): Promise<BattleReply> {
  const needsAcknowledgement = ["move", "finish", "skip"].includes(action.type);
  try {
    const reply = await request(url, action, 6000);
    if (!needsAcknowledgement || acknowledged(reply, action)) return reply;
  } catch (error) {
    if (!recoverable(error)) throw error;
  }
  recovering();
  try {
    const reply = await request(url, undefined, 6000);
    if (acknowledged(reply, action)) return reply;
  } catch (error) {
    if (!recoverable(error)) throw error;
  }
  const reply = await request(url, action, 6000);
  if (!needsAcknowledgement || acknowledged(reply, action)) return reply;
  throw Object.assign(new Error("Your move wasn't saved. Resume the puzzle to try again."), { status: 503 });
}
