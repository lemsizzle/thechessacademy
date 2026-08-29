import { describe, expect, it } from "vitest";
import {
  CorrespondenceServerError,
  parseCorrespondenceAction,
  parseCorrespondenceChallengeInput,
  parseCorrespondenceSeenInput,
  validCorrespondenceId
} from "@/chess/persistence/correspondenceServer";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CHALLENGE_ID = "22222222-2222-4222-8222-222222222222";

describe("correspondence server input validation", () => {
  it("accepts only UUID student and challenge identifiers", () => {
    expect(validCorrespondenceId(STUDENT_ID)).toBe(STUDENT_ID);
    expect(() => validCorrespondenceId("student-1")).toThrow(CorrespondenceServerError);
    expect(parseCorrespondenceChallengeInput({ recipientStudentId: STUDENT_ID })).toEqual({ recipientStudentId: STUDENT_ID });
    expect(() => parseCorrespondenceChallengeInput({ recipientStudentId: "" })).toThrow("Invalid student ID");
  });

  it("accepts only the three challenge actions", () => {
    expect(parseCorrespondenceAction({ action: "accept" })).toBe("accept");
    expect(parseCorrespondenceAction({ action: "reject" })).toBe("reject");
    expect(parseCorrespondenceAction({ action: "cancel" })).toBe("cancel");
    expect(() => parseCorrespondenceAction({ action: "delete" })).toThrow("Choose accept, reject, or cancel");
  });

  it("validates optional unique challenge IDs for seen updates", () => {
    expect(parseCorrespondenceSeenInput(null)).toBeNull();
    expect(parseCorrespondenceSeenInput({})).toBeNull();
    expect(parseCorrespondenceSeenInput({ challengeIds: [CHALLENGE_ID] })).toEqual([CHALLENGE_ID]);
    expect(() => parseCorrespondenceSeenInput({ challengeIds: [CHALLENGE_ID, CHALLENGE_ID] })).toThrow("must be unique");
    expect(() => parseCorrespondenceSeenInput({ challengeIds: ["bad"] })).toThrow("Invalid challenge ID");
  });
});
