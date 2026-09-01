import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  isValidAdminSession: vi.fn(),
  isValidAdminActionToken: vi.fn(),
  setAdminQuestActive: vi.fn()
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/auth/adminSession", () => ({
  ADMIN_SESSION_COOKIE: "quest_board_admin_session",
  isValidAdminSession: mocks.isValidAdminSession,
  isValidAdminActionToken: mocks.isValidAdminActionToken
}));
vi.mock("@/lib/quests/supabaseQuests", () => ({
  deleteAdminQuest: vi.fn(),
  setAdminQuestActive: mocks.setAdminQuestActive
}));

import { PATCH } from "@/app/api/admin/quests/[id]/route";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/quests/quest-1", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-action-token": "action-token"
    },
    body: JSON.stringify(body)
  });
}

const context = { params: Promise.resolve({ id: "quest-1" }) };

describe("admin quest activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "session-cookie" })) });
    mocks.isValidAdminSession.mockResolvedValue(true);
    mocks.isValidAdminActionToken.mockResolvedValue(false);
  });

  it("rejects unauthenticated changes", async () => {
    mocks.isValidAdminSession.mockResolvedValue(false);

    const response = await PATCH(request({ isActive: false }), context);

    expect(response.status).toBe(401);
    expect(mocks.setAdminQuestActive).not.toHaveBeenCalled();
  });

  it("requires an explicit boolean activation state", async () => {
    const response = await PATCH(request({ isActive: "false" }), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "isActive must be true or false." });
    expect(mocks.setAdminQuestActive).not.toHaveBeenCalled();
  });

  it.each([true, false])("sets isActive to %s without changing other quest fields", async (isActive) => {
    const quest = { id: "quest-1", title: "Training Quest", isActive };
    mocks.setAdminQuestActive.mockResolvedValue(quest);

    const response = await PATCH(request({ isActive }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ quest });
    expect(mocks.setAdminQuestActive).toHaveBeenCalledWith("quest-1", isActive);
  });
});
