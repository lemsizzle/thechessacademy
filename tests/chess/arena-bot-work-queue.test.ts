import {describe,expect,it} from "vitest";
import {createArenaBotWorkQueue} from "@/chess/arena/botWorkQueue";
describe("Arena bot CPU queue",()=>{
  it("deduplicates games and bounds concurrent engine work",async()=>{
    const queue=createArenaBotWorkQueue(2);let active=0,peak=0,calls=0;
    const work=async()=>{calls++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;};
    await Promise.all([queue("a",work),queue("a",work),queue("b",work),queue("c",work),queue("d",work)]);
    expect(calls).toBe(4);expect(peak).toBe(2);
    await queue("a",work);expect(calls).toBe(5);
  });
  it("releases capacity when work fails",async()=>{
    const queue=createArenaBotWorkQueue(1);
    await expect(queue("a",async()=>{throw Error("failed");})).rejects.toThrow("failed");
    let finished=false;await queue("a",async()=>{finished=true;});expect(finished).toBe(true);
  });
  it("does not retain a job that throws before returning a promise",async()=>{
    const queue=createArenaBotWorkQueue(1);
    await expect(queue("a",()=>{throw Error("sync failure");})).rejects.toThrow("sync failure");
    let finished=false;await queue("a",async()=>{finished=true;});expect(finished).toBe(true);
  });
});
