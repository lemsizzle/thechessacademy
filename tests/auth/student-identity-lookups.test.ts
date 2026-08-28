import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  readStudentSession: vi.fn(),
  createStudentSession: vi.fn((input) => input),
  sessionToStudentUser: vi.fn((session) => ({ studentId: session.studentId })),
  setStudentSessionCookie: vi.fn(),
  findSupabaseStudentById: vi.fn(),
  findSupabaseStudentByLichess: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth/session", () => ({
  readStudentSession: mocks.readStudentSession,
  createStudentSession: mocks.createStudentSession,
  sessionToStudentUser: mocks.sessionToStudentUser,
  setStudentSessionCookie: mocks.setStudentSessionCookie
}));
vi.mock("@/lib/students/supabaseStudentProfiles", () => ({
  findSupabaseStudentById: mocks.findSupabaseStudentById,
  findSupabaseStudentByLichess: mocks.findSupabaseStudentByLichess
}));
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseProjectConfigured: () => true
}));

import { GET } from "@/app/api/auth/session/route";

const studentId = "11111111-1111-4111-8111-111111111111";
const student = {
  id: studentId,
  name: "Test Student"
};

describe("student auth session lookup hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn() });
  });

  it("uses an identity-only ID lookup for an established student session", async () => {
    mocks.readStudentSession.mockReturnValue({
      studentId,
      name: "Test Student",
      lichessUserId: "lichess-id",
      lichessUsername: "TestStudent",
      onboardingCompleted: true
    });
    mocks.findSupabaseStudentById.mockResolvedValue({ configured: true, student });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.findSupabaseStudentById).toHaveBeenCalledWith(studentId, { includeRelations: false });
    expect(mocks.findSupabaseStudentByLichess).not.toHaveBeenCalled();
  });

  it("uses an identity-only Lichess lookup while repairing a pending session", async () => {
    mocks.readStudentSession.mockReturnValue({
      studentId: "pending-lichess-id",
      name: "TestStudent",
      lichessUserId: "lichess-id",
      lichessUsername: "TestStudent",
      onboardingCompleted: false
    });
    mocks.findSupabaseStudentByLichess.mockResolvedValue({ configured: true, student });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.findSupabaseStudentById).not.toHaveBeenCalled();
    expect(mocks.findSupabaseStudentByLichess).toHaveBeenCalledWith(
      "lichess-id",
      "TestStudent",
      { includeRelations: false }
    );
  });
});
