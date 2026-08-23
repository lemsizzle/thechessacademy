export type QueuedPremove = { from: string; to: string };
export type PremoveReplyContext = { fen: string; token: string };

export type PremoveHandoff = {
  queued: QueuedPremove | null;
  reply: PremoveReplyContext | null;
  ready: boolean;
};

export function emptyPremoveHandoff(): PremoveHandoff {
  return { queued: null, reply: null, ready: false };
}

export function withQueuedPremove(state: PremoveHandoff, queued: QueuedPremove | null): PremoveHandoff {
  return { ...state, queued };
}

export function withPremoveReply(state: PremoveHandoff, reply: PremoveReplyContext): PremoveHandoff {
  return { ...state, reply, ready: false };
}

export function withPremoveReplyReady(state: PremoveHandoff): PremoveHandoff {
  return { ...state, ready: true };
}

export function takeReadyPremove(state: PremoveHandoff): {
  state: PremoveHandoff;
  execution: { premove: QueuedPremove; reply: PremoveReplyContext } | null;
} {
  if (!state.ready || !state.queued || !state.reply) return { state, execution: null };
  return {
    state: emptyPremoveHandoff(),
    execution: { premove: state.queued, reply: state.reply }
  };
}
