import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyStudentDashboardTraining, emptyStudentDashboardQuestSummary, type StudentDashboardData } from "@/lib/student/dashboardProjection";

const mocks = vi.hoisted(() => ({ client: vi.fn(), dashboard: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerReadClient: mocks.client }));
vi.mock("@/lib/student/dashboard", () => ({ getStudentDashboardData: mocks.dashboard }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
import { getPublicStudentDashboard } from "@/lib/student/publicDashboard";
import { StudentJourneyDashboard } from "@/components/student/StudentJourneyDashboard";

const dashboard: StudentDashboardData = {
  student: { id: "viewed-student", name: "Tob", classGroup: "Tuesday Rooks" },
  progress: { lifetimeXp: 460, level: 3, title: "Bishop Adept", currentLevelXp: 185, nextLevelXp: 275, neededXp: 90, percent: 67, isMaxLevel: false },
  wallet: { academyCoins: 42, totalCoinsEarned: 42, totalCoinsSpent: 0 },
  avatar: null, lichess: null, training: emptyStudentDashboardTraining, quests: emptyStudentDashboardQuestSummary, badges: [], unavailableSections: [],
  activity: [{ id: "xp", kind: "xp", title: "XP earned", detail: "Private teacher adjustment note", amount: 10 }]
};

beforeEach(() => { vi.clearAllMocks(); mocks.dashboard.mockResolvedValue(dashboard); });

it("resolves only the requested active profile, then uses read-only dashboard data", async () => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: dashboard.student.id }, error: null }) };
  mocks.client.mockReturnValue({ from: () => query });
  const result = await getPublicStudentDashboard("master-chief117");
  expect(query.eq).toHaveBeenCalledWith("public_slug", "master-chief117");
  expect(query.eq).toHaveBeenCalledWith("is_active", true);
  expect(mocks.dashboard).toHaveBeenCalledWith("viewed-student", { readOnly: true });
  expect(result?.activity[0].detail).toBe("+10 XP.");
  expect(JSON.stringify(result)).not.toContain("Private teacher adjustment");
});

it("never substitutes a sample student for missing or archived profiles", async () => {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
  mocks.client.mockReturnValue({ from: () => query });
  expect(await getPublicStudentDashboard("missing")).toBeNull();
  expect(mocks.dashboard).not.toHaveBeenCalled();
});

describe("shared dashboard presentation", () => {
  it("keeps dashboard sections and progress popups while removing owner destinations", () => {
    const html = renderToStaticMarkup(createElement(StudentJourneyDashboard, { data: dashboard, readOnly: true }));
    for (const text of ["Tob", "Tuesday Rooks", "Bishop Adept", "460 lifetime XP", "42 coins", "View Progress", "Daily chess inspiration", "Mixed Survival best", "Trophy Case", "Recent activity", "View all activity"]) expect(html).toContain(text);
    for (const href of ["/student/avatar", "/student/play/history", "/student/quests", "/student/training", "/student/play"]) expect(html).not.toContain(`href="${href}"`);
    expect(html).not.toContain("Next Goal");
    expect(html).toContain("Training &amp; quest stats");
    expect(html).toContain("Latest Woodpecker");
    expect(html).toContain("0 active · 0 completed");
    for (const text of ["journey-map-heading", "destinations", "Build tactical vision", "Computer and live games", "Create your Academy look"]) expect(html).not.toContain(text);
  });
  it("leaves the student's own dashboard actions available", () => {
    const html = renderToStaticMarkup(createElement(StudentJourneyDashboard, { data: dashboard }));
    for (const href of ["/student/avatar", "/student/play/history", "/student/quests", "/student/training", "/student/play"]) expect(html).toContain(`href="${href}"`);
    expect(html).toContain("Choose any destination");
    expect(html).not.toContain("profile-stats-heading");
  });
});
