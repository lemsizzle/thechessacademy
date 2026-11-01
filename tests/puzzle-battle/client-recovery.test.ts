import { describe, expect, it, vi } from "vitest";
import { submitBattleWithRecovery } from "@/lib/puzzle-battle/clientRecovery";
import type { BattleAction, BattleView } from "@/lib/puzzle-battle/types";
const action: BattleAction = { type: "move", actionId: "stable-action", revision: 4, move: { from:"e4",to:"e5" } };
const reply = (revision = 4, lastAction: string | null = null, status = "playing") => ({
  battle: { me: "student", state: { status, players: [{ id:"student",revision,lastAction }] } } as BattleView,
});
describe("battle connection recovery", () => {
  it("keeps healthy moves to one request", async () => {
    const result=reply(5,action.actionId), request=vi.fn().mockResolvedValue(result), recovering=vi.fn();
    expect(await submitBattleWithRecovery("/battle",action,request,recovering)).toBe(result);
    expect(request).toHaveBeenCalledTimes(1); expect(recovering).not.toHaveBeenCalled();
  });
  it("recovers a saved move whose response was dropped, without resubmitting", async () => {
    const result=reply(5,action.actionId), request=vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(result);
    expect(await submitBattleWithRecovery("/battle",action,request,vi.fn())).toBe(result);
    expect(request.mock.calls.map(call=>call[1])).toEqual([action,undefined]);
  });
  it("retries an unsaved move with the original ID and revision", async () => {
    const request=vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply(5,action.actionId));
    await submitBattleWithRecovery("/battle",action,request,vi.fn());
    expect(request.mock.calls.map(call=>call[1])).toEqual([action,undefined,action]);
  });
  it.each([reply(6,"another-tab"),reply(4,null,"finished")])("accepts authoritative progress or match end during recovery", async result => {
    const request=vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(result);
    expect(await submitBattleWithRecovery("/battle",action,request,vi.fn())).toBe(result);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("bounds failed recovery instead of looping or holding input forever", async () => {
    const request=vi.fn().mockRejectedValue(new Error("offline"));
    await expect(submitBattleWithRecovery("/battle",action,request,vi.fn())).rejects.toThrow("offline");
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("recovers an unchanged HTTP 200 instead of silently discarding the move", async () => {
    const result=reply(5,action.actionId), recovering=vi.fn();
    const request=vi.fn().mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply()).mockResolvedValueOnce(result);
    expect(await submitBattleWithRecovery("/battle",action,request,recovering)).toBe(result);
    expect(request.mock.calls.map(call=>call[1])).toEqual([action,undefined,action]);
    expect(recovering).toHaveBeenCalledTimes(1);
  });
  it.each(["move","finish","skip"] as const)("exposes a retry when a %s remains unacknowledged", async type => {
    const request=vi.fn().mockResolvedValue(reply());
    await expect(submitBattleWithRecovery("/battle",{...action,type},request,vi.fn()))
      .rejects.toMatchObject({status:503,message:expect.stringContaining("wasn't saved")});
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("reconciles newer progress without rebasing the old move onto a different puzzle", async () => {
    const result=reply(6,"another-tab"), request=vi.fn().mockResolvedValueOnce(reply()).mockResolvedValueOnce(result);
    expect(await submitBattleWithRecovery("/battle",action,request,vi.fn())).toBe(result);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("preserves successful non-move controls without requiring a personal revision", async () => {
    const result=reply(), request=vi.fn().mockResolvedValue(result);
    expect(await submitBattleWithRecovery("/battle",{type:"ready",actionId:"ready"},request,vi.fn())).toBe(result);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([400,401,403,409,429])("does not replay rejected %s requests", async status => {
    const request=vi.fn().mockRejectedValue(Object.assign(new Error("rejected"),{status}));
    await expect(submitBattleWithRecovery("/battle",action,request,vi.fn())).rejects.toThrow("rejected");
    expect(request).toHaveBeenCalledTimes(1);
  });
});
