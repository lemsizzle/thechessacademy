import { describe, expect, it } from "vitest";
import {
  emptyPremoveHandoff,
  takeReadyPremove,
  withPremoveReply,
  withPremoveReplyReady,
  withQueuedPremove
} from "@/lib/puzzle-training/premoveQueue";

const premove = { from: "e2", to: "c1" };
const reply = { fen: "reply-fen", token: "next-token" };

describe("puzzle premove handoff", () => {
  it("executes once when the premove is queued before the reply becomes ready", () => {
    let state = withQueuedPremove(emptyPremoveHandoff(), premove);
    state = withPremoveReply(state, reply);
    state = withPremoveReplyReady(state);

    const first = takeReadyPremove(state);
    expect(first.execution).toEqual({ premove, reply });
    expect(takeReadyPremove(first.state).execution).toBeNull();
  });

  it("executes once when the premove arrives after the reply becomes ready", () => {
    let state = withPremoveReply(emptyPremoveHandoff(), reply);
    state = withPremoveReplyReady(state);
    expect(takeReadyPremove(state).execution).toBeNull();

    state = withQueuedPremove(state, premove);
    const result = takeReadyPremove(state);
    expect(result.execution).toEqual({ premove, reply });
    expect(result.state).toEqual(emptyPremoveHandoff());
  });
});
