import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyPuzzleTrainingOverview } from "@/lib/puzzle-training/overview";
import type { Student } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  findSupabaseStudentById: vi.fn(),
  getStudentAvatarState: vi.fn(),
  listStudentCoinTransactions: vi.fn(),
  listAdminBadges: vi.fn(),
  getStoredLichessAccount: vi.fn(),
  getStudentPuzzleTrainingOverview: vi.fn(),
  getSupabaseQuestTracking: vi.fn(),
  listAdminQuests: vi.fn(),
  getSupabaseServiceClient: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/students/supabaseStudentProfiles", () => ({
  findSupabaseStudentById: mocks.findSupabaseStudentById
}));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({
  getStudentAvatarState: mocks.getStudentAvatarState,
  listStudentCoinTransactions: mocks.listStudentCoinTransactions
}));
vi.mock("@/lib/badges/supabaseBadges", () => ({ listAdminBadges: mocks.listAdminBadges }));
vi.mock("@/lib/lichess/supabaseAccounts", () => ({ getStoredLichessAccount: mocks.getStoredLichessAccount }));
vi.mock("@/lib/puzzle-training/overviewServer", () => ({
  getStudentPuzzleTrainingOverview: mocks.getStudentPuzzleTrainingOverview
}));
vi.mock("@/lib/quests/supabaseQuestProgress", () => ({ getSupabaseQuestTracking: mocks.getSupabaseQuestTracking }));
vi.mock("@/lib/quests/supabaseQuests", () => ({ listAdminQuests: mocks.listAdminQuests }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));

const student: Student = {
  id: "student-a",
  slug: "student-a",
  name: "Student A",
  avatar: "S",
  classGroup: "Monday",
  totalXp: 275,
  badgeIds: [],
  encouragement: "Keep going."
};

function serviceQuery(result: { data: unknown[]; error: { message: string } | null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    then: (
      resolve: (value: { data: unknown[]; error: { message: string } | null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject)
  };
  return query;
}

describe("getStudentDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findSupabaseStudentById.mockResolvedValue({ configured: true, student });
    mocks.getStudentAvatarState.mockResolvedValue({
      source: "supabase",
      items: [],
      avatar: { studentId: student.id, equippedItems: {} },
      wallet: { studentId: student.id, academyCoins: 40, totalCoinsEarned: 50, totalCoinsSpent: 10 }
    });
    mocks.listStudentCoinTransactions.mockResolvedValue([]);
    mocks.listAdminBadges.mockResolvedValue([]);
    mocks.getStoredLichessAccount.mockResolvedValue(null);
    mocks.getStudentPuzzleTrainingOverview.mockResolvedValue(emptyPuzzleTrainingOverview);
    mocks.getSupabaseQuestTracking.mockResolvedValue({ configured: true, attempts: [], progress: [], completions: [] });
    mocks.listAdminQuests.mockResolvedValue([]);
  });

  it("uses the indexed student activity query shape and returns JSON-safe data", async () => {
    const query = serviceQuery({
      data: [{
        id: "xp-1",
        student_id: student.id,
        amount: 10,
        reason: "Academy puzzle solved (Survival).",
        created_at: "2026-08-28T12:00:00.000Z"
      }],
      error: null
    });
    const badgeQuery = serviceQuery({ data: [], error: null });
    mocks.getSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => table === "xp_events" ? query : badgeQuery)
    });

    const { getStudentDashboardData } = await import("@/lib/student/dashboard");
    const dashboard = await getStudentDashboardData(student.id);

    expect(query.eq).toHaveBeenCalledWith("student_id", student.id);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(dashboard.activity).toHaveLength(1);
    expect(dashboard.wallet.academyCoins).toBe(40);
    expect(() => JSON.parse(JSON.stringify(dashboard))).not.toThrow();
  });

  it("keeps the required student projection available when optional sources fail", async () => {
    mocks.getStudentAvatarState.mockRejectedValue(new Error("avatar unavailable"));
    mocks.getStudentPuzzleTrainingOverview.mockRejectedValue(new Error("training unavailable"));
    mocks.listAdminQuests.mockRejectedValue(new Error("quests unavailable"));
    mocks.getSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => serviceQuery({
        data: [],
        error: table === "xp_events" ? { message: "activity unavailable" } : null
      }))
    });

    const { getStudentDashboardData } = await import("@/lib/student/dashboard");
    const dashboard = await getStudentDashboardData(student.id);

    expect(dashboard.student).toMatchObject({ id: student.id, name: student.name });
    expect(dashboard.avatar).toBeNull();
    expect(dashboard.wallet.academyCoins).toBe(0);
    expect(dashboard.training).toEqual(emptyPuzzleTrainingOverview);
    expect(dashboard.quests).toEqual({ activeCount: 0, completedCount: 0, soonestExpiring: null });
    expect(dashboard.unavailableSections).toEqual(expect.arrayContaining(["avatar", "quests", "training", "activity"]));
  });

  it("keeps the fallback avatar visible without presenting its seeded wallet as live data", async () => {
    mocks.getStudentAvatarState.mockResolvedValue({
      source: "seed",
      items: [],
      avatar: { studentId: student.id, equippedItems: {} },
      wallet: { studentId: student.id, academyCoins: 0, totalCoinsEarned: 0, totalCoinsSpent: 0 }
    });
    mocks.getSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => serviceQuery({ data: [], error: null }))
    });

    const { getStudentDashboardData } = await import("@/lib/student/dashboard");
    const dashboard = await getStudentDashboardData(student.id);

    expect(dashboard.avatar).not.toBeNull();
    expect(dashboard.wallet.academyCoins).toBe(0);
    expect(dashboard.unavailableSections).toContain("avatar");
  });
});
