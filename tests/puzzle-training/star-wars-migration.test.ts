import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260829084909_add_star_wars_leaderboard.sql"),
  "utf8"
).toLowerCase().replace(/\s+/g, " ");

const challengeModesMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260902123938_add_training_challenge_modes.sql"),
  "utf8"
).toLowerCase().replace(/\s+/g, " ");

describe("Star Wars leaderboard database migration", () => {
  it("keeps runs server-only behind RLS and least-privilege grants", () => {
    expect(migration).toContain("alter table public.student_star_wars_runs enable row level security");
    expect(migration).toContain("revoke all on table public.student_star_wars_runs from public, anon, authenticated, service_role");
    expect(migration).toContain("grant select, insert, update on table public.student_star_wars_runs to service_role");
  });

  it("bounds scores and exposes only a service-role security-invoker report", () => {
    expect(migration).toContain("check (score between 0 and 500)");
    expect(migration).toContain("unique (student_id, run_id)");
    expect(migration).toContain("function public.get_star_wars_leaderboard()");
    expect(migration).toContain("security invoker");
    expect(migration).not.toContain("security definer");
    expect(migration).toContain("grant execute on function public.get_star_wars_leaderboard() to service_role");
  });

  it("does not rank zero-score runs", () => {
    expect(migration).toContain("where run.score > 0");
  });

  it("stores only the supported Star Wars run modes and countdowns", () => {
    expect(challengeModesMigration).toContain("check (mode in ('classic', 'time_trial'))");
    expect(challengeModesMigration).toContain("time_limit_ms in (60000, 180000, 300000)");
    expect(challengeModesMigration).toContain("add column if not exists started_at timestamptz not null default now()");
  });
});
