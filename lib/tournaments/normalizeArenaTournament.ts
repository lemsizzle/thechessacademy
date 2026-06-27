import type { Tournament, TournamentSource, TournamentStatus } from "@/lib/types";

type ArenaRaw = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ArenaRaw : undefined;
}

function dateValue(value: unknown) {
  const date = typeof value === "number" || typeof value === "string" ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function inferStatus(raw: ArenaRaw, startsAt: string, durationMinutes?: number): TournamentStatus {
  if (raw.isFinished === true) return "finished";
  if (raw.isStarted === true) return "ongoing";
  const status = stringValue(raw.status)?.toLowerCase();
  if (status === "created") return "upcoming";
  if (status === "started") return "ongoing";
  if (status === "finished") return "finished";
  const start = new Date(startsAt).getTime();
  const end = durationMinutes ? start + durationMinutes * 60_000 : undefined;
  if (start > Date.now()) return "upcoming";
  if (end && end > Date.now()) return "ongoing";
  if (end && end <= Date.now()) return "finished";
  return "unknown";
}

type NormalizeArenaOptions = {
  teamId?: string;
  source?: TournamentSource;
  isPublic?: boolean;
  importedAt?: string;
};

export function normalizeArenaTournament(raw: ArenaRaw, options: NormalizeArenaOptions = {}): Tournament {
  const lichessId = stringValue(raw.id) ?? stringValue(raw.slug) ?? crypto.randomUUID();
  const durationMinutes = numberValue(raw.minutes) ?? numberValue(raw.duration);
  const startsAt = dateValue(raw.startsAt ?? raw.createdAt);
  const perf = objectValue(raw.perf);
  const variant = objectValue(raw.variant);
  const clock = objectValue(raw.clock);
  const limit = numberValue(clock?.limit);
  const increment = numberValue(clock?.increment);

  return {
    id: `lichess-arena-${lichessId}`,
    lichessId,
    name: stringValue(raw.fullName) ?? stringValue(raw.name) ?? "Lichess Arena",
    status: inferStatus(raw, startsAt, durationMinutes),
    startsAt,
    endsAt: durationMinutes ? new Date(new Date(startsAt).getTime() + durationMinutes * 60_000).toISOString() : undefined,
    durationMinutes,
    url: stringValue(raw.url) ?? `https://lichess.org/tournament/${lichessId}`,
    teamId: options.teamId,
    createdBy: stringValue(raw.createdBy) ?? stringValue(raw.createdByUsername),
    rated: typeof raw.rated === "boolean" ? raw.rated : undefined,
    variant: stringValue(variant?.key) ?? stringValue(raw.variant) ?? "standard",
    speed: stringValue(perf?.key) ?? stringValue(raw.speed),
    timeControl: limit !== undefined && increment !== undefined ? `${Math.round(limit / 60)}+${increment}` : undefined,
    playerCount: numberValue(raw.nbPlayers) ?? numberValue(raw.players),
    source: options.source ?? "team_sync",
    isPublic: options.isPublic ?? true,
    rawData: raw,
    syncedAt: new Date().toISOString(),
    importedAt: options.importedAt
  };
}
