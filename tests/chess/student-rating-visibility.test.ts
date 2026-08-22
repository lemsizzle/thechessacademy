import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/student/chess-rating/route";

describe("student Academy rating visibility", () => {
  it("does not expose the teacher rating dashboard through the student API", async () => {
    const response = await GET();
    const body = await response.json() as { ok: boolean; dashboard?: unknown; error?: string };

    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.dashboard).toBeUndefined();
    expect(body.error).toMatch(/teachers only/i);
  });
});
