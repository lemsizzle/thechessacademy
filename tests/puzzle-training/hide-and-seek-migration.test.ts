import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260829080040_hide_and_seek_training.sql"),
  "utf8"
).toLowerCase().replace(/\s+/g, " ");

const leaderboardPresenceMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260829151000_hide_and_seek_leaderboard_attempt_presence.sql"),
  "utf8"
).toLowerCase().replace(/\s+/g, " ");

const timeTrialMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260831173615_add_hide_and_seek_time_trial.sql"),
  "utf8"
).toLowerCase().replace(/\s+/g, " ");

describe("Hide and Seek database migration", () => {
  it("keeps attempt data server-only behind RLS and least-privilege grants", () => {
    expect(migration).toContain("alter table public.student_hide_and_seek_attempts enable row level security");
    expect(migration).toContain("revoke all on table public.student_hide_and_seek_attempts from public, anon, authenticated, service_role");
    expect(migration).toContain("grant select, insert on table public.student_hide_and_seek_attempts to service_role");
    expect(migration).not.toContain("grant select, insert, update");
  });

  it("enforces bounded authoritative results and one attempt per round", () => {
    expect(migration).toContain("unique (student_id, round_id)");
    expect(migration).toContain("check (safe_square_count between 10 and 24)");
    expect(migration).toContain("check (elapsed_ms between 0 and 1800000)");
    expect(migration).toContain("check (score between 0 and 1000)");
    expect(migration).toContain("student_hide_and_seek_attempts_personal_best_idx");
  });

  it("exposes only security-invoker service-role reporting functions", () => {
    expect(migration).toContain("function public.get_hide_and_seek_leaderboard()");
    expect(migration).toContain("function public.get_student_hide_and_seek_overview(p_student_id uuid)");
    expect((migration.match(/security invoker/g) ?? [])).toHaveLength(2);
    expect(migration).not.toContain("security definer");
    expect(migration).toContain("grant execute on function public.get_hide_and_seek_leaderboard() to service_role");
    expect(migration).toContain("grant execute on function public.get_student_hide_and_seek_overview(uuid) to service_role");
  });

  it("tracks attempt presence for legitimate zero-point leaderboard results", () => {
    expect(leaderboardPresenceMigration).toContain("all_time_attempts bigint");
    expect(leaderboardPresenceMigration).toContain("month_attempts bigint");
    expect(leaderboardPresenceMigration).toContain("week_attempts bigint");
    expect(leaderboardPresenceMigration).toContain("count(*) filter (where attempt.completed_at >= now() - interval '7 days') as week_attempts");
    expect(leaderboardPresenceMigration).toContain("security invoker");
    expect(leaderboardPresenceMigration).toContain("grant execute on function public.get_hide_and_seek_leaderboard() to service_role");
    expect(leaderboardPresenceMigration).not.toContain("security definer");
  });

  it("stores the ruleset and permits a zero-mark automatic Time Trial result", () => {
    expect(timeTrialMigration).toContain("add column if not exists mode text not null default 'classic'");
    expect(timeTrialMigration).toContain("check (mode in ('classic', 'time_trial'))");
    expect(timeTrialMigration).toContain("check (cardinality(selected_squares) between 0 and 56)");
  });
});
