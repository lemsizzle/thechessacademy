import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
  const tableCalls: string[] = [];
  const student = {
    id: "11111111-1111-4111-8111-111111111111",
    display_name: "Test Student",
    public_slug: "test-student",
    avatar_url: null,
    class_group: "Saturday",
    total_xp: 250,
    is_active: true,
    lichess_id: "lichess-id",
    lichess_username: "TestStudent"
  };

  return {
    tableCalls,
    client: {
      from(table: string) {
        tableCalls.push(table);

        if (table === "students") {
          const query = {
            select() {
              return query;
            },
            eq() {
              return query;
            },
            ilike() {
              return query;
            },
            maybeSingle() {
              return Promise.resolve({ data: student, error: null });
            }
          };
          return query;
        }

        const data = table === "student_badges"
          ? [{ student_id: student.id, badge_id: "badge-1" }]
          : [
            { student_id: student.id, quest_id: "quest-complete", status: "completed" },
            { student_id: student.id, quest_id: "quest-active", status: "active" }
          ];
        const query = {
          select() {
            return query;
          },
          in() {
            return Promise.resolve({ data, error: null });
          }
        };
        return query;
      }
    }
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/avatar/supabaseAvatar", () => ({
  grantAcademyCoinsForXp: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerReadClient: () => supabaseMock.client,
  getSupabaseServiceClient: () => null,
  isSupabaseProjectConfigured: () => true,
  isSupabaseServiceConfigured: () => true
}));

import {
  findSupabaseStudentById,
  findSupabaseStudentByLichess
} from "@/lib/students/supabaseStudentProfiles";

describe("Supabase student lookup hydration", () => {
  beforeEach(() => {
    supabaseMock.tableCalls.length = 0;
  });

  it("skips badge and quest queries for identity-only ID lookups", async () => {
    const result = await findSupabaseStudentById(
      "11111111-1111-4111-8111-111111111111",
      { includeRelations: false }
    );

    expect(supabaseMock.tableCalls).toEqual(["students"]);
    expect(result.student).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Test Student",
      badgeIds: [],
      completedQuestIds: []
    });
  });

  it("skips badge and quest queries for identity-only Lichess lookups", async () => {
    const result = await findSupabaseStudentByLichess(
      "lichess-id",
      "TestStudent",
      { includeRelations: false }
    );

    expect(supabaseMock.tableCalls).toEqual(["students"]);
    expect(result.student?.id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("keeps full relation hydration as the default for profile callers", async () => {
    const result = await findSupabaseStudentById("11111111-1111-4111-8111-111111111111");

    expect(supabaseMock.tableCalls).toEqual(["students", "student_badges", "student_quests"]);
    expect(result.student?.badgeIds).toEqual(["badge-1"]);
    expect(result.student?.completedQuestIds).toEqual(["quest-complete"]);
  });
});
