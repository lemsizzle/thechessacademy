import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { getBotProgression, getBotUnlockRequirement, qualifiesForBotUnlock } from "@/chess/bots/progression";
import { GameSetup } from "@/chess/components/GameSetup";

const mocks = vi.hoisted(() => ({
  getSupabaseServiceClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServiceClient: mocks.getSupabaseServiceClient
}));

import { getStudentBotProgression, requireStudentBotUnlocked } from "@/chess/persistence/botProgressionServer";

function botDefeatsQuery(botIds: string[]) {
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  } = {
    select: vi.fn(),
    eq: vi.fn()
  };
  query.select.mockReturnValue(query);
  query.eq
    .mockResolvedValueOnce({
      data: botIds.map((botId) => ({ bot_id: botId })),
      error: null
    });
  return {
    from: vi.fn().mockReturnValue(query),
    query
  };
}

function botButton(markup: string, botName: string) {
  const nameIndex = markup.indexOf(`>${botName}<`);
  const buttonStart = markup.lastIndexOf("<button", nameIndex);
  const buttonEnd = markup.indexOf("</button>", nameIndex);
  return markup.slice(buttonStart, buttonEnd);
}

describe("computer opponent progression", () => {
  beforeEach(() => {
    mocks.getSupabaseServiceClient.mockReset();
  });

  it("starts every student with only Pawny and Sir Lem unlocked", () => {
    expect(getBotProgression([]).unlockedBotIds).toEqual(["pawny", "so-pawny"]);
  });

  it("unlocks each academy bot only after the previous bot is defeated", () => {
    expect(getBotProgression(["pawny"]).unlockedBotIds).toEqual(["pawny", "knight", "so-pawny"]);
    expect(getBotProgression(["pawny", "knight"]).unlockedBotIds).toEqual(["pawny", "knight", "bishop", "so-pawny"]);
    expect(getBotProgression(["pawny", "knight", "bishop", "rook"]).unlockedBotIds).toEqual(
      BOT_DIFFICULTIES.map((bot) => bot.id)
    );
  });

  it("does not let historical wins skip an earlier opponent", () => {
    const progression = getBotProgression(["knight", "bishop", "rook", "queen", "so-pawny"]);
    expect(progression.unlockedBotIds).toEqual(["pawny", "so-pawny"]);
  });

  it("explains which opponent unlocks a locked bot", () => {
    expect(getBotUnlockRequirement("knight")).toEqual({ botId: "pawny", botName: "Pawny" });
    expect(getBotUnlockRequirement("queen")).toEqual({ botId: "rook", botName: "Rocky Rook" });
    expect(getBotUnlockRequirement("so-pawny")).toBeNull();
  });

  it("requires a win with no takebacks to unlock the next bot", () => {
    expect(qualifiesForBotUnlock("win", 0)).toBe(true);
    expect(qualifiesForBotUnlock("win", 1)).toBe(false);
    expect(qualifiesForBotUnlock("draw", 0)).toBe(false);
    expect(qualifiesForBotUnlock("loss", 0)).toBe(false);
  });

  it("renders the starting bots as playable and later bots as disabled", () => {
    const markup = renderToStaticMarkup(createElement(GameSetup, {
      unlockedBotIds: ["pawny", "so-pawny"],
      onStart: vi.fn()
    }));

    expect(botButton(markup, "Pawny")).not.toContain("disabled");
    expect(botButton(markup, "Pawny")).toContain("Complete Beginner");
    expect(markup).not.toContain("~375");
    expect(markup).not.toContain("~1600");
    expect(botButton(markup, "Sir Lem")).not.toContain("disabled");
    expect(botButton(markup, "Zippy Knight")).toContain("disabled");
    expect(botButton(markup, "Zippy Knight")).toContain("Defeat Pawny without takebacks to unlock.");
    expect(botButton(markup, "Benny Bishop")).toContain("disabled");
  });

  it("derives unlocks only from the post-reset progression ledger", async () => {
    const client = botDefeatsQuery(["pawny", "knight"]);
    mocks.getSupabaseServiceClient.mockReturnValue(client);

    await expect(getStudentBotProgression("student-1")).resolves.toEqual({
      defeatedBotIds: ["pawny", "knight"],
      unlockedBotIds: ["pawny", "knight", "bishop", "so-pawny"]
    });
    expect(client.from).toHaveBeenCalledWith("student_bot_defeats");
    expect(client.query.eq).toHaveBeenCalledWith("student_id", "student-1");
  });

  it("rejects a locked opponent on the server", async () => {
    mocks.getSupabaseServiceClient.mockReturnValue(botDefeatsQuery(["pawny"]));

    await expect(requireStudentBotUnlocked("student-1", "bishop")).rejects.toThrow(
      "Defeat Zippy Knight to unlock this opponent."
    );
  });
});
