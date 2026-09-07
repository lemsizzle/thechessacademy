import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), manage: vi.fn() }));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>({value:"cookie"})})}));
vi.mock("@/lib/auth/adminSession",()=>({ADMIN_SESSION_COOKIE:"session",isAuthorizedAdminRequest:mocks.auth}));
vi.mock("@/chess/persistence/arenaServer",()=>({manageInternalArenaBot:mocks.manage,InternalArenaServerError:class extends Error{status=400;}}));
import {POST,PATCH,DELETE} from "@/app/api/admin/internal-arenas/[tournamentId]/bots/route";
const context={params:Promise.resolve({tournamentId:"arena"})};
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue(true);mocks.manage.mockResolvedValue({arena:{id:"arena"}});});
describe("teacher-only Arena bot endpoints",()=>{
  it.each([POST,PATCH,DELETE])("denies requests without teacher authorization",async handler=>{
    mocks.auth.mockResolvedValue(false);
    const response=await handler(new Request("http://localhost/api",{method:"POST",body:'{"difficultyId":"queen"}'}),context);
    expect(response.status).toBe(401);expect(mocks.manage).not.toHaveBeenCalled();
  });
  it.each([[POST,"add"],[PATCH,"update"],[DELETE,"remove"]] as const)("forwards only the expected operation",async(handler,action)=>{
    const body={botId:"bot",name:"Class helper",difficultyId:"rook",action:"spoof"};
    const response=await handler(new Request("http://localhost/api",{method:"POST",body:JSON.stringify(body),headers:{"x-admin-action-token":"teacher-token"}}),context);
    expect(response.status).toBe(200);
    expect(mocks.manage).toHaveBeenCalledWith("arena",action,body,action==="add"?undefined:"bot");
    expect(mocks.auth).toHaveBeenCalledWith("cookie","teacher-token");
  });
  it("rejects malformed update payloads",async()=>{
    const response=await PATCH(new Request("http://localhost/api",{method:"PATCH",body:'{}'}),context);
    expect(response.status).toBe(400);expect(mocks.manage).not.toHaveBeenCalled();
  });
});
