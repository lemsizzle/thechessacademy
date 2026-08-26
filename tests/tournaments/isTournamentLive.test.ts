import { describe, expect, it } from "vitest";
import { isTournamentLive } from "@/lib/tournaments/isTournamentLive";

const now = Date.parse("2026-08-26T12:00:00.000Z");

describe("isTournamentLive", () => {
  it("detects a tournament inside its scheduled window before a stale status refresh", () => {
    expect(isTournamentLive({
      status: "upcoming",
      startsAt: "2026-08-26T11:30:00.000Z",
      endsAt: "2026-08-26T12:30:00.000Z"
    }, now)).toBe(true);
  });

  it("does not keep an ongoing tournament live after its end time", () => {
    expect(isTournamentLive({
      status: "ongoing",
      startsAt: "2026-08-26T10:00:00.000Z",
      durationMinutes: 60
    }, now)).toBe(false);
  });

  it("accepts an ongoing tournament when no end time is available", () => {
    expect(isTournamentLive({
      status: "ongoing",
      startsAt: "2026-08-26T11:45:00.000Z"
    }, now)).toBe(true);
  });

  it("never treats a finished tournament as live", () => {
    expect(isTournamentLive({
      status: "finished",
      startsAt: "2026-08-26T11:30:00.000Z",
      endsAt: "2026-08-26T12:30:00.000Z"
    }, now)).toBe(false);
  });
});
