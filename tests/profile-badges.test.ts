import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileBadgeCase } from "@/components/ProfileBadgeCase";
import { BadgeCard } from "@/components/BadgeCard";
import type { Badge, Student } from "@/lib/types";

const data = vi.hoisted(() => ({ dashboard: vi.fn() }));
vi.mock("@/lib/student/publicDashboard", () => ({ getPublicStudentDashboard: data.dashboard }));
vi.mock("@/components/student/StudentPortalShell", () => ({ StudentPortalShell: () => null }));
vi.mock("@/lib/useMockAdminState", () => ({ useMockAdminState: () => ({ students: [], loaded: true }) }));
vi.mock("@/components/StudentProfile", () => ({ StudentProfile: ({ badges, student }: { badges: Badge[]; student: Student }) => createElement(ProfileBadgeCase, { badges, badgeIds: student.badgeIds }) }));
import StudentFacingProfilePage from "@/app/student/students/[slug]/page";
import { StudentJourneyDashboard } from "@/components/student/StudentJourneyDashboard";
import { emptyStudentDashboardTraining, emptyStudentDashboardQuestSummary, buildStudentDashboardProgress } from "@/lib/student/dashboardProjection";

function badge(id: string, tier: Badge["tier"]): Badge {
  return { id, tier, name: `Fork ${tier}`, category: "Tactics", tacticTheme: "Fork", description: "Fork tactics", xpValue: 0, unlockRequirement: "Survival", visualTheme: "chess", artImageUrl: `/badges/${id}.png`, finalImageUrl: null, generationStatus: "selected" };
}
const bronze = badge("current-bronze-uuid", "Bronze");
const gold = badge("current-gold-uuid", "Gold");
const locked = badge("unearned-platinum", "Platinum");
const quest: Badge = { ...badge("quest-award", "Silver"), name: "Quest Champion", category: "Tournament", tacticTheme: undefined };
const badges = [bronze, gold, locked, quest];
const student: Student = { id: "student", slug: "player", name: "Player", avatar: "P", classGroup: "Knights", totalXp: 10, badgeIds: [bronze.id, gold.id, quest.id], encouragement: "Keep learning" };

describe("profile badges", () => {
  it("shows artwork immediately, with only the highest earned tactic tier and quest badges", () => {
    const html = renderToStaticMarkup(createElement(ProfileBadgeCase, { badges, badgeIds: student.badgeIds }));
    expect(html).toContain("Trophy Case");
    expect(html).toContain('aria-label="Earned badges"');
    expect(html).toContain('src="/badges/current-gold-uuid.png"');
    expect(html).toContain("View Quest Champion badge details");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain("View Fork Bronze badge details");
    expect(html).not.toContain("unearned-platinum");
    expect(html).not.toContain("Fork tactics");
  });

  it("keeps the lower earned tiers available to the existing badge popup", () => {
    const tree = ProfileBadgeCase({ badges, badgeIds: student.badgeIds });
    const grid = tree.props.children[1] as ReactElement<{ children: ReactElement[] }>;
    const card = grid.props.children[0];
    expect(card.type).toBe(BadgeCard);
    expect(card.props).toMatchObject({ badge: gold, earned: true, earnedTiers: [gold, bronze] });
  });

  it("shows an honest empty case after awards are removed", () => {
    const html = renderToStaticMarkup(createElement(ProfileBadgeCase, { badges, badgeIds: [] }));
    expect(html).toContain("No badges earned yet.");
    expect(html).not.toContain("badge details");
  });

  it("uses the real dashboard in read-only mode for student-facing profiles", async () => {
    const dashboard = { student, badges: [bronze, gold, quest], progress: buildStudentDashboardProgress(student), avatar: null, wallet: { academyCoins: 20, totalCoinsEarned: 20, totalCoinsSpent: 0 }, training: emptyStudentDashboardTraining, quests: emptyStudentDashboardQuestSummary, activity: [], lichess: null, unavailableSections: [] };
    data.dashboard.mockResolvedValue(dashboard);
    const page = await StudentFacingProfilePage({ params: Promise.resolve({ slug: "player" }) });
    expect(data.dashboard).toHaveBeenCalledWith("player");
    expect(page.props.children.type).toBe(StudentJourneyDashboard);
    expect(page.props.children.props).toMatchObject({ data: dashboard, readOnly: true });
  });
});
