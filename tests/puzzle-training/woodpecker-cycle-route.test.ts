import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

const serverMocks = vi.hoisted(() => ({
  requirePuzzleStudent: vi.fn(),
  saveCompletedWoodpeckerCycle: vi.fn(),
  saveCompletedWoodpeckerSet: vi.fn()
}));

vi.mock("@/lib/puzzle-training/server", () => serverMocks);

import { POST } from "@/app/api/student/puzzle-training/woodpecker-cycle/route";

const studentId = "10000000-0000-4000-8000-000000000001";
const runId = "20000000-0000-4000-8000-000000000002";
const sessions = [
  "30000000-0000-4000-8000-000000000003",
  "40000000-0000-4000-8000-000000000004",
  "50000000-0000-4000-8000-000000000005"
];

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/student/puzzle-training/woodpecker-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function cycleBody(cycleNumber: 1 | 2 | 3, setSize = 20) {
  return {
    sessionId: sessions[cycleNumber - 1],
    setSize,
    runId,
    cycleNumber,
    cycleSessionIds: sessions.slice(0, cycleNumber)
  };
}

describe("Woodpecker cycle completion route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverMocks.requirePuzzleStudent.mockResolvedValue({ studentId });
    serverMocks.saveCompletedWoodpeckerCycle.mockResolvedValue({
      setSize: 20,
      puzzlesPerMinute: 4,
      accuracy: 100,
      theme: "mixed",
      completedAt: "2026-08-28T00:00:00.000Z"
    });
    serverMocks.saveCompletedWoodpeckerSet.mockResolvedValue({
      setSize: 20,
      cycleCount: 3,
      theme: "mixed",
      startedAt: "2026-08-27T00:00:00.000Z",
      completedAt: "2026-08-28T00:00:00.000Z"
    });
  });

  it("binds an ordinary cycle without recording a full set", async () => {
    const response = await POST(request(cycleBody(1)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ setCompleted: false });
    expect(serverMocks.saveCompletedWoodpeckerCycle).toHaveBeenCalledWith(
      studentId,
      sessions[0],
      20,
      { runId, cycleNumber: 1 }
    );
    expect(serverMocks.saveCompletedWoodpeckerSet).not.toHaveBeenCalled();
  });

  it("records the quest evidence only after cycle three of a 20-puzzle set", async () => {
    const response = await POST(request(cycleBody(3)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ setCompleted: true });
    expect(serverMocks.saveCompletedWoodpeckerSet).toHaveBeenCalledWith({
      studentId,
      runId,
      cycleSessionIds: sessions
    });
  });

  it("does not record larger Woodpecker sets for this quest", async () => {
    const response = await POST(request(cycleBody(3, 30)));

    expect(response.status).toBe(200);
    expect(serverMocks.saveCompletedWoodpeckerSet).not.toHaveBeenCalled();
  });

  it.each([
    { ...cycleBody(3), cycleSessionIds: sessions.slice(0, 2) },
    { ...cycleBody(3), cycleSessionIds: [...sessions, "60000000-0000-4000-8000-000000000006"] },
    { ...cycleBody(2), sessionId: sessions[0] },
    { ...cycleBody(1), runId: "not-a-uuid" }
  ])("rejects malformed or unordered cycle identity before writing", async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(serverMocks.saveCompletedWoodpeckerCycle).not.toHaveBeenCalled();
    expect(serverMocks.saveCompletedWoodpeckerSet).not.toHaveBeenCalled();
  });

  it("separates authentication failures from invalid completion proof", async () => {
    serverMocks.requirePuzzleStudent.mockRejectedValueOnce(new StudentAuthenticationError("Student log in required."));
    const unauthorized = await POST(request(cycleBody(3)));
    expect(unauthorized.status).toBe(401);

    serverMocks.saveCompletedWoodpeckerCycle.mockRejectedValueOnce(new Error("This Woodpecker cycle is not complete yet."));
    const incomplete = await POST(request(cycleBody(3)));
    expect(incomplete.status).toBe(400);
  });
});
