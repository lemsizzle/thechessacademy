import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { BadgeDetails } from "@/components/BadgeCard";
import type { Badge } from "@/lib/types";

const badge: Badge = { id: "earned-badge", name: "Fork Finder", category: "Tactics", tier: "Gold", description: "", xpValue: 0, unlockRequirement: "Solve fork puzzles", visualTheme: "chess", finalImageUrl: "/badge.webp", artImageUrl: null, generationStatus: "selected" };
const render = (props: Partial<Parameters<typeof BadgeDetails>[0]> = {}) => renderToStaticMarkup(createElement(BadgeDetails, { badge, earnedTiers: [badge], statusText: "Earned", onClose: () => {}, ...props }));

describe("feature badge popup", () => {
  it("offers featuring in the student's earned trophy popup", () => {
    expect(render({ featureStudentId: "student" })).toContain(">Feature badge</button>");
  });
  it("offers unfeaturing for the exact selected badge", () => {
    const html = render({ featureStudentId: "student", displayedBadge: { id: badge.id, name: badge.name, imageUrl: "/badge.webp", tier: "Gold" } });
    expect(html).toContain(">Unfeature badge</button>");
    expect(html).toContain("This badge is featured beside your name.");
  });
  it("never offers selection in catalog or read-only badge popups", () => {
    expect(render({ statusText: "Badge catalog" })).not.toContain(">Feature badge</button>");
    expect(render()).not.toContain(">Unfeature badge</button>");
  });
});
