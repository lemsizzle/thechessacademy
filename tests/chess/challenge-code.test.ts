import { describe, expect, it } from "vitest";
import {
  CHALLENGE_CODE_LENGTH,
  cleanChallengeCode,
  generateChallengeCode,
  isSupportedChallengeCode
} from "@/chess/live/challengeCode";

describe("live challenge codes", () => {
  it("generates four uppercase alphanumeric characters", () => {
    expect(CHALLENGE_CODE_LENGTH).toBe(4);
    expect(generateChallengeCode(new Uint8Array([0, 25, 26, 35]))).toBe("AZ09");
    expect(generateChallengeCode()).toMatch(/^[A-Z0-9]{4}$/);
  });

  it("cleans codes students paste or type", () => {
    expect(cleanChallengeCode(" a7-k2 ")).toBe("A7K2");
  });

  it("accepts new codes and legacy waiting challenges", () => {
    expect(isSupportedChallengeCode("A7K2")).toBe(true);
    expect(isSupportedChallengeCode("ABCD2345WXYZ")).toBe(true);
    expect(isSupportedChallengeCode("ABC12")).toBe(false);
  });
});
