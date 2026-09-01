import { describe, expect, it } from "vitest";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import {
  chessJsColor,
  fromChessJsColor,
  oppositeColor,
  resolvePlayerColor
} from "@/chess/game/colors";
import {
  BOT_DIFFICULTIES as COMPAT_BOT_DIFFICULTIES,
  TIME_CONTROLS as COMPAT_TIME_CONTROLS,
  oppositeColor as compatOppositeColor
} from "@/chess/game/config";
import { TIME_CONTROLS } from "@/chess/game/timeControls";

describe("game configuration modules", () => {
  it("keeps the legacy config exports compatible", () => {
    expect(COMPAT_BOT_DIFFICULTIES).toBe(BOT_DIFFICULTIES);
    expect(COMPAT_TIME_CONTROLS).toBe(TIME_CONTROLS);
    expect(compatOppositeColor).toBe(oppositeColor);
  });

  it("maps player and chess.js colors", () => {
    expect(resolvePlayerColor("white")).toBe("white");
    expect(resolvePlayerColor("random", () => 0.49)).toBe("white");
    expect(resolvePlayerColor("random", () => 0.5)).toBe("black");
    expect(oppositeColor("white")).toBe("black");
    expect(chessJsColor("black")).toBe("b");
    expect(fromChessJsColor("w")).toBe("white");
  });

  it("preserves the supported time controls", () => {
    expect(TIME_CONTROLS.map((control) => control.id)).toEqual(["none", "3+2", "5+3", "7+2", "10m", "10+5", "15+10"]);
    expect(TIME_CONTROLS.filter((control) => ["3+2", "5+3", "7+2"].includes(control.id))).toEqual([
      { id: "3+2", name: "3 + 2", initialMs: 180_000, incrementMs: 2_000 },
      { id: "5+3", name: "5 + 3", initialMs: 300_000, incrementMs: 3_000 },
      { id: "7+2", name: "7 + 2", initialMs: 420_000, incrementMs: 2_000 }
    ]);
  });
});
