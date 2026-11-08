import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),admin:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/requireActiveStudent",()=>({requireActiveStudent:m.auth,StudentAuthenticationError:class extends Error{}}));
vi.mock("@/lib/auth/adminSession",()=>({ADMIN_SESSION_COOKIE:"admin",isAuthorizedAdminRequest:m.admin}));
vi.mock("next/headers",()=>({cookies:async()=>({get:()=>undefined})}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseServiceClient:()=>({rpc:m.rpc})}));
import {GET,POST} from "@/app/api/student/puzzle-tournaments/route";
import {GET as adminGET,POST as adminPOST} from "@/app/api/admin/puzzle-tournaments/route";
import {StudentAuthenticationError} from "@/lib/auth/requireActiveStudent";
const id="30000000-0000-4000-8000-000000000001";
const request=(body?:unknown)=>new Request(`http://localhost/api/student/puzzle-tournaments?id=${id}`,body?{method:"POST",body:JSON.stringify(body)}:undefined);
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({studentId:id,name:"Real learner"});m.admin.mockResolvedValue(false);m.rpc.mockResolvedValue({data:{id},error:null});});
it("requires teacher authorization before creation or reads",async()=>{
  expect((await adminGET(request())).status).toBe(401);
  expect((await adminPOST(request({action:"create"}))).status).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("rejects expired students and student attempts to host or add bots",async()=>{
  expect((await POST(request({action:"bot",id}))).status).toBe(403);
  expect((await POST(request({action:"start",id}))).status).toBe(403);
  expect((await POST(request({action:"schedule",id}))).status).toBe(403);
  m.auth.mockRejectedValue(new StudentAuthenticationError());
  expect((await GET(request())).status).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("accepts explicit timezone schedules for teachers and rejects invalid dates",async()=>{
  m.admin.mockResolvedValue(true);
  const startsAt="2027-01-01T14:30:00+07:00";
  expect((await adminPOST(request({action:"create",requestId:id,title:"Later",mode:"survival",duration:60,rounds:2,startsAt}))).status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("create_scheduled_puzzle_tournament",expect.objectContaining({p_starts_at:"2027-01-01T07:30:00.000Z"}));
  expect((await adminPOST(request({action:"schedule",id,version:2,startsAt:null}))).status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("set_puzzle_tournament_schedule",{p_id:id,p_version:2,p_starts_at:null});
  for(const value of ["nonsense","2027-01-01T10:00",123]) expect((await adminPOST(request({action:"schedule",id,version:2,startsAt:value}))).status).toBe(400);
});
it("joins only the signed-in student, ignoring supplied identity or rating",async()=>{
  expect((await POST(request({action:"join",id,studentId:"victim",name:"Fake",elo:2400}))).status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("edit_puzzle_tournament_entry",expect.objectContaining({p_entry:expect.objectContaining({studentId:id,name:"Real learner"})}));
  const args=m.rpc.mock.calls[0][1];expect(args.p_entry.elo).toBeUndefined();
});
it("requests only the student-safe snapshot and disables shared caching",async()=>{
  const response=await GET(request());expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(m.rpc).toHaveBeenCalledWith("puzzle_tournament_snapshot",{p_id:id,p_teacher:false,p_student_id:id});
});
it("validates ratings and preserves bot request IDs",async()=>{
  m.admin.mockResolvedValue(true);
  expect((await adminPOST(request({action:"bot",id,requestId:id,name:"Maple",elo:900}))).status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("edit_puzzle_tournament_entry",{p_id:id,p_action:"bot",p_entry:{id,name:"Maple",elo:900}});
  expect((await adminPOST(request({action:"bot",id,requestId:id,name:"Maple",elo:9000}))).status).toBe(400);
});
