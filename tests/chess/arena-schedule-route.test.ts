import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),schedule:vi.fn(),status:vi.fn()}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>({value:"cookie"})})}));
vi.mock("@/lib/auth/adminSession",()=>({ADMIN_SESSION_COOKIE:"session",isAuthorizedAdminRequest:mocks.auth}));
vi.mock("@/chess/persistence/arenaServer",()=>({updateInternalArenaSchedule:mocks.schedule,updateInternalArenaStatus:mocks.status,InternalArenaServerError:class extends Error{status=400;}}));
import { PATCH } from "@/app/api/admin/internal-arenas/[tournamentId]/route";
const context={params:Promise.resolve({tournamentId:"arena"})};
const request=()=>new Request("http://localhost/api",{method:"PATCH",body:JSON.stringify({action:"schedule",durationMinutes:90,startsAt:"2026-09-20T12:00:00Z"})});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue(true);mocks.schedule.mockResolvedValue({id:"arena"});});
it("requires teacher authorization",async()=>{
  mocks.auth.mockResolvedValue(false); expect((await PATCH(request(),context)).status).toBe(401); expect(mocks.schedule).not.toHaveBeenCalled();
});
it("routes schedule edits to the schedule validator",async()=>{
  expect((await PATCH(request(),context)).status).toBe(200);
  expect(mocks.schedule).toHaveBeenCalledWith("arena",{action:"schedule",durationMinutes:90,startsAt:"2026-09-20T12:00:00Z"});
  expect(mocks.status).not.toHaveBeenCalled();
});
