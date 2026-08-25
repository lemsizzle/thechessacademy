export type RealtimePresenceState = Record<string, Array<Record<string, unknown>>>;

export function hasCoachPresence(state: RealtimePresenceState) {
  return Object.values(state).some((presences) =>
    presences.some((presence) => presence.role === "coach")
  );
}
