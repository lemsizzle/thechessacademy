import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { StudentAuthenticationError, requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import {
  STAR_WARS_GENERATOR_VERSION,
  STAR_WARS_MAX_ROUTE_MOVES,
  attemptStarWarsMove,
  initialStarWarsState,
  isStarWarsMode,
  isStarWarsTimeLimitMs,
  starWarsPuzzleForScore,
  type StarWarsMode,
  type StarWarsMove,
  type StarWarsTimeLimitMs
} from "@/lib/puzzle-training/starWars";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export class StarWarsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StarWarsInputError";
  }
}

export type StarWarsStartResult = {
  runId: string;
  runVariant: number;
  score: number;
  personalBest: number;
  mode: StarWarsMode;
  timeLimitMs: StarWarsTimeLimitMs | null;
  startedAt: string;
  serverSentAt: string;
};

export type StarWarsProgressResult = {
  score: number;
  personalBest: number;
};

type StarWarsRunRow = {
  generator_version: number | string;
  run_variant: number | string;
  score: number | string;
  mode?: string | null;
  time_limit_ms?: number | string | null;
  started_at?: string | null;
};

const MAX_STAR_WARS_SCORE = 500;
export const STAR_WARS_ACTIVATION_GRACE_MS = 2_000;
export const STAR_WARS_TIME_TRIAL_SUBMISSION_GRACE_MS = 15_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SQUARE_PATTERN = /^[a-h][1-8]$/;

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Star Wars requires Supabase service access.");
  return client;
}

function numberInRange(value: unknown, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export function parseStarWarsStartOptions(value: unknown): {
  mode: StarWarsMode;
  timeLimitMs: StarWarsTimeLimitMs | null;
} {
  if (value === undefined || value === null) return { mode: "classic", timeLimitMs: null };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new StarWarsInputError("The Star Wars start request must be a JSON object.");
  }
  const body = value as { mode?: unknown; timeLimitMs?: unknown };
  const mode = body.mode ?? "classic";
  if (!isStarWarsMode(mode)) throw new StarWarsInputError("Choose Classic or Time Trial mode.");
  if (mode === "classic") {
    if (body.timeLimitMs !== undefined && body.timeLimitMs !== null) {
      throw new StarWarsInputError("Classic Star Wars does not use a time limit.");
    }
    return { mode, timeLimitMs: null };
  }
  if (!isStarWarsTimeLimitMs(body.timeLimitMs)) {
    throw new StarWarsInputError("Choose a 1, 3, or 5 minute Star Wars time trial.");
  }
  return { mode, timeLimitMs: body.timeLimitMs };
}

export function isStarWarsTimeTrialSubmissionOpen(input: {
  startedAtMs: number;
  timeLimitMs: StarWarsTimeLimitMs;
  receivedAtMs: number;
}) {
  return input.receivedAtMs
    <= input.startedAtMs + input.timeLimitMs + STAR_WARS_TIME_TRIAL_SUBMISSION_GRACE_MS;
}

function parseMove(value: unknown): StarWarsMove {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StarWarsInputError("A Star Wars route contains an invalid move.");
  }
  const move = value as Record<string, unknown>;
  if (typeof move.from !== "string"
    || typeof move.to !== "string"
    || !SQUARE_PATTERN.test(move.from)
    || !SQUARE_PATTERN.test(move.to)) {
    throw new StarWarsInputError("A Star Wars route contains an invalid square.");
  }
  return { from: move.from as StarWarsMove["from"], to: move.to as StarWarsMove["to"] };
}

export function parseStarWarsRoutes(value: unknown): StarWarsMove[][] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_STAR_WARS_SCORE) {
    throw new StarWarsInputError("Submit between 1 and 500 completed Star Wars missions.");
  }
  return value.map((route) => {
    if (!Array.isArray(route) || route.length < 1 || route.length > STAR_WARS_MAX_ROUTE_MOVES) {
      throw new StarWarsInputError("A Star Wars mission route has an invalid length.");
    }
    return route.map(parseMove);
  });
}

export function verifyStarWarsRoute(score: number, runVariant: number, route: readonly StarWarsMove[]) {
  const puzzle = starWarsPuzzleForScore(score, runVariant);
  if (route.length !== puzzle.stars.length) {
    throw new StarWarsInputError("The submitted Star Wars route is incomplete.");
  }
  let state = initialStarWarsState(puzzle);
  for (const [index, move] of route.entries()) {
    const result = attemptStarWarsMove(state, move);
    const shouldFinish = index === route.length - 1;
    if (result.status === "illegal" || result.status === "failed") {
      throw new StarWarsInputError("The submitted Star Wars route is not valid.");
    }
    if ((result.status === "solved") !== shouldFinish) {
      throw new StarWarsInputError("The submitted Star Wars route does not match this mission.");
    }
    state = result.state;
  }
}

async function getPersonalBest(studentId: string) {
  const { data, error } = await serviceClient()
    .from("student_star_wars_runs")
    .select("score")
    .eq("student_id", studentId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return numberInRange((data as { score?: unknown } | null)?.score, 0, MAX_STAR_WARS_SCORE) ?? 0;
}

async function getRun(studentId: string, runId: string) {
  const { data, error } = await serviceClient()
    .from("student_star_wars_runs")
    .select("generator_version,run_variant,score,mode,time_limit_ms,started_at")
    .eq("student_id", studentId)
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new StarWarsInputError("This Star Wars run could not be found. Start a new run.");
  return data as StarWarsRunRow;
}

export async function startStarWarsRun(
  studentId: string,
  options: { mode: StarWarsMode; timeLimitMs: StarWarsTimeLimitMs | null } = { mode: "classic", timeLimitMs: null },
  nowMs?: number
): Promise<StarWarsStartResult> {
  const normalized = parseStarWarsStartOptions(options);
  const activationMs = nowMs ?? Date.now();
  const runId = randomUUID();
  const runVariant = randomBytes(4).readUInt32BE(0);
  const startedAt = new Date(activationMs + STAR_WARS_ACTIVATION_GRACE_MS).toISOString();
  const { error } = await serviceClient().from("student_star_wars_runs").insert({
    student_id: studentId,
    run_id: runId,
    generator_version: STAR_WARS_GENERATOR_VERSION,
    run_variant: runVariant,
    score: 0,
    mode: normalized.mode,
    time_limit_ms: normalized.timeLimitMs,
    started_at: startedAt
  });
  if (error) throw new Error(error.message);
  return {
    runId,
    runVariant,
    score: 0,
    personalBest: await getPersonalBest(studentId),
    mode: normalized.mode,
    timeLimitMs: normalized.timeLimitMs,
    startedAt,
    serverSentAt: new Date(nowMs ?? Date.now()).toISOString()
  };
}

export async function saveStarWarsProgress(input: {
  studentId: string;
  runId: unknown;
  startScore: unknown;
  routes: unknown;
  nowMs?: number;
}): Promise<StarWarsProgressResult> {
  if (typeof input.runId !== "string" || !UUID_PATTERN.test(input.runId)) {
    throw new StarWarsInputError("A valid Star Wars run is required.");
  }
  const routes = parseStarWarsRoutes(input.routes);
  const startScore = numberInRange(input.startScore, 0, MAX_STAR_WARS_SCORE - 1);
  if (startScore === null || startScore + routes.length > MAX_STAR_WARS_SCORE) {
    throw new StarWarsInputError("The submitted Star Wars score range is invalid.");
  }
  const submittedScore = startScore + routes.length;
  const run = await getRun(input.studentId, input.runId);
  const generatorVersion = numberInRange(run.generator_version, 1, 32);
  const runVariant = numberInRange(run.run_variant, 0, 0xffff_ffff);
  const savedScore = numberInRange(run.score, 0, MAX_STAR_WARS_SCORE);
  const mode = run.mode ?? "classic";
  const timeLimitMs = run.time_limit_ms === null || run.time_limit_ms === undefined
    ? null
    : numberInRange(run.time_limit_ms, 1, 300_000);
  const startedAtMs = typeof run.started_at === "string" ? Date.parse(run.started_at) : Number.NaN;
  if (generatorVersion !== STAR_WARS_GENERATOR_VERSION || runVariant === null || savedScore === null) {
    throw new StarWarsInputError("This Star Wars run uses an unsupported mission generator.");
  }
  if (!isStarWarsMode(mode)
    || (mode === "classic" && timeLimitMs !== null)
    || (mode === "time_trial" && !isStarWarsTimeLimitMs(timeLimitMs))
    || !Number.isFinite(startedAtMs)) {
    throw new StarWarsInputError("This Star Wars run has invalid timing settings.");
  }

  if (startScore > savedScore) {
    throw new StarWarsInputError("Star Wars missions must be saved in order. Retry your latest score.");
  }

  if (submittedScore > savedScore) {
    const receivedAt = input.nowMs ?? Date.now();
    if (mode === "time_trial"
      && timeLimitMs !== null
      && !isStarWarsTimeTrialSubmissionOpen({
        startedAtMs,
        timeLimitMs: timeLimitMs as StarWarsTimeLimitMs,
        receivedAtMs: receivedAt
      })) {
      throw new StarWarsInputError("Time is up for this Star Wars run.");
    }
    for (let score = savedScore; score < submittedScore; score += 1) {
      verifyStarWarsRoute(score, runVariant, routes[score - startScore]);
    }
    const { error } = await serviceClient()
      .from("student_star_wars_runs")
      .update({ score: submittedScore, updated_at: new Date().toISOString() })
      .eq("student_id", input.studentId)
      .eq("run_id", input.runId)
      .lt("score", submittedScore);
    if (error) throw new Error(error.message);
  }

  const authoritative = await getRun(input.studentId, input.runId);
  const score = numberInRange(authoritative.score, 0, MAX_STAR_WARS_SCORE);
  if (score === null) throw new Error("The saved Star Wars score is invalid.");
  return { score, personalBest: Math.max(score, await getPersonalBest(input.studentId)) };
}

export async function requireStarWarsStudent() {
  return requireActiveStudent();
}

export function isStarWarsAuthenticationError(error: unknown) {
  return error instanceof StudentAuthenticationError;
}
