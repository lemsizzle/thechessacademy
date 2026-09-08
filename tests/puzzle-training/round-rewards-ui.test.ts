import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurvivalRoundRewards, SurvivalRoundRewardsView } from "@/components/training/SurvivalRoundRewards";
import type { SurvivalRoundRewards as Rewards } from "@/lib/puzzle-training/roundRewards";

function render(rewards: Partial<Rewards> = {}) {
  return renderToStaticMarkup(createElement(SurvivalRoundRewardsView, {
    rewards: { xp: 20, puzzleCoins: 20, badgeCoins: 0, badges: [], ...rewards }
  }));
}
describe("Survival round rewards panel", () => {
  it("shows XP and coins even without a new badge", () => {
    const html = render();
    expect(html).toContain("XP earned");
    expect(html).toContain("Coins earned");
    expect(html.match(/\+20/g)).toHaveLength(2);
    expect(html).toContain("No new badges this round.");
    expect(html).not.toContain("New badges earned");
  });
  it("shows new badge artwork and sums puzzle plus badge coins once", () => {
    const html = render({ badgeCoins: 20, badges: [{ badgeId: "pin", name: "Pin Bronze", tier: "C", category: "Tactics", imageUrl: "/pin-art.png", coins: 20 }] });
    expect(html).toContain('src="/pin-art.png"');
    expect(html).toContain('alt="Pin Bronze badge artwork"');
    expect(html).toContain("Bronze · +20 coins");
    expect(html).toContain("+40");
    expect(html).toContain("Includes 20 bonus coins");
    expect(html).not.toContain("+60");
  });
  it("uses tier artwork fallback when artwork has not been set", () => {
    const html = render({ badges: [{ badgeId: "fork", name: "Fork Silver", tier: "B", category: "Tactics", imageUrl: null, coins: 40 }] });
    expect(html).toContain("/mock-badge-art/silver-1.svg");
  });
  it("shows honest zero rewards for a no-solve round", () => {
    expect(render({ xp: 0, puzzleCoins: 0 }).match(/\+0/g)).toHaveLength(2);
  });
  it("starts with loading, not false zero totals", () => {
    const html = renderToStaticMarkup(createElement(SurvivalRoundRewards, { sessionId: "new-round" }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading your round rewards");
    expect(html).not.toContain("+0");
  });
});
