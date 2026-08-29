import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { StudentAuthenticationError, requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import {
  STAR_WARS_GENERATOR_VERSION,
  attemptStarWarsMove,
  initialStarWarsState,
  starWarsPuzzleForScore,
  type StarWarsMove
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
};

export type StarWarsProgressResult = {
  score: number;
  personalBest: number;
};

type StarWarsRunRow = {
  generator_version: number | string;
  run_variant: number | string;
  score: number | string;
};

const MAX_STAR_WARS_SCORE = 500;
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
    if (!Array.isArray(route) || route.length < 1 || route.length > 7) {
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
    .select("generator_version,run_variant,score")
    .eq("student_id", studentId)
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new StarWarsInputError("This Star Wars run could not be found. Start a new run.");
  return data as StarWarsRunRow;
}

export async function startStarWarsRun(studentId: string): Promise<StarWarsStartResult> {
  const runId = randomUUID();
  const runVariant = randomBytes(4).readUInt32BE(0);
  const { error } = await serviceClient().from("student_star_wars_runs").insert({
    student_id: studentId,
    run_id: runId,
    generator_version: STAR_WARS_GENERATOR_VERSION,
    run_variant: runVariant,
    score: 0
  });
  if (error) throw new Error(error.message);
  return { runId, runVariant, score: 0, personalBest: await getPersonalBest(studentId) };
}

export async function saveStarWarsProgress(input: {
  studentId: string;
  runId: unknown;
  startScore: unknown;
  routes: unknown;
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
  if (generatorVersion !== STAR_WARS_GENERATOR_VERSION || runVariant === null || savedScore === null) {
    throw new StarWarsInputError("This Star Wars run uses an unsupported mission generator.");
  }

  if (startScore > savedScore) {
    throw new StarWarsInputError("Star Wars missions must be saved in order. Retry your latest score.");
  }

  if (submittedScore > savedScore) {
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
