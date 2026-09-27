import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), chat: vi.fn() }));
vi.mock("@/lib/auth/requireActiveStudent", () => ({ requireActiveStudent: mocks.auth, StudentAuthenticationError: class extends Error {} }));
vi.mock("@/chess/persistence/arenaServer", () => ({ getStudentInternalArenaChat: mocks.chat, InternalArenaServerError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
import { GET } from "@/app/api/student/internal-arenas/[tournamentId]/chat/route";
import { StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { InternalArenaServerError } from "@/chess/persistence/arenaServer";
const read = () => GET(new Request("http://localhost/chat?studentId=imposter"), { params: Promise.resolve({ tournamentId: "arena" }) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ studentId: "session-student" }); mocks.chat.mockResolvedValue({ messages: [], canChat: true }); });
it("uses authenticated identity and prevents shared caching", async () => {
  const response = await read();
  expect(mocks.chat).toHaveBeenCalledWith("arena", "session-student");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ messages: [], canChat: true });
});
it("rejects unauthenticated reads", async () => {
  mocks.auth.mockRejectedValue(new StudentAuthenticationError("Log in"));
  expect((await read()).status).toBe(401); expect(mocks.chat).not.toHaveBeenCalled();
});
it("preserves membership denial", async () => {
  mocks.chat.mockRejectedValue(new InternalArenaServerError("Join first", 403));
  expect((await read()).status).toBe(403);
});
