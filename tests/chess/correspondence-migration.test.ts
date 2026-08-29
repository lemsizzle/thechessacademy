import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260829100650_add_student_correspondence_challenges.sql"
  ),
  "utf8"
)
  .toLowerCase()
  .replace(/\s+/g, " ");

describe("student correspondence database migration", () => {
  it("adds backward-compatible live and completed game modes", () => {
    expect(migration).toContain("add column if not exists game_mode text not null default 'live'");
    expect(migration).toContain("check (game_mode in ('live', 'correspondence'))");
    expect(migration).toContain("and days_per_move = 3");
    expect(migration).toContain("and time_control_id = 'none'");
    expect(migration).not.toContain("set game_mode = 'live'");
  });

  it("keeps challenge and inbox data server-only", () => {
    expect(migration).toContain("alter table public.student_correspondence_inboxes enable row level security");
    expect(migration).toContain("alter table public.student_correspondence_challenges enable row level security");
    expect(migration).toContain(
      "revoke all on table public.student_correspondence_challenges from public, anon, authenticated, service_role"
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.student_correspondence_challenges to service_role"
    );
    expect(migration).not.toContain("grant select on table public.student_correspondence_challenges to authenticated");
  });

  it("enforces one unordered pending challenge and indexed participant lookups", () => {
    expect(migration).toContain("student_correspondence_challenges_pending_pair_unique");
    expect(migration).toContain("least(challenger_id, recipient_id)");
    expect(migration).toContain("greatest(challenger_id, recipient_id)");
    expect(migration).toContain("where status = 'pending'");
    expect(migration).toContain("student_correspondence_challenges_incoming_pending_idx");
    expect(migration).toContain("student_correspondence_challenges_outgoing_pending_idx");
    expect(migration).toContain("student_correspondence_challenges_pending_expiry_idx");
  });

  it("creates idempotent, capped, random-color correspondence games atomically", () => {
    expect(migration).toContain("function public.respond_student_correspondence_challenge(");
    expect(migration).toContain("for update");
    expect(migration).toContain("if p_action = 'accept' and v_challenge.status = 'accepted'");
    expect(migration).toContain("if v_challenger_games >= 10 or v_recipient_games >= 10");
    expect(migration).toContain("where game_mode = 'correspondence' and status = 'active'");
    expect(migration).not.toContain("and turn_deadline_at > clock_timestamp()");
    expect(migration).toContain("if v_outgoing_count >= 5");
    expect(migration).toContain("if random() < 0.5");
    expect(migration).toContain("v_now + interval '3 days'");
    expect(migration).toContain("now() + interval '7 days'");
  });

  it("settles deadlines and prevents late writes", () => {
    expect(migration).toContain("function public.settle_correspondence_game_deadlines(");
    expect(migration).toContain("and game.turn_deadline_at <= v_now");
    expect(migration).toContain("winner_color = case game.active_color when 'white' then 'black' else 'white' end");
    expect(migration).toContain("result_reason = 'timeout'");
    expect(migration).toContain("turn_deadline_at = null");
    expect(migration).toContain("function public.prepare_correspondence_game_write()");
    expect(migration).toContain("not (new.status = 'completed' and new.result_reason = 'timeout')");
    expect(migration).toContain("raise exception 'the correspondence move deadline has expired.'");
    expect(migration).toContain("new.turn_deadline_at := v_now + make_interval(days => new.days_per_move)");
  });

  it("uses only opaque minimal realtime invalidations", () => {
    expect(migration).toContain("'challengeid', new.id");
    expect(migration).toContain("'status', new.status");
    expect(migration).toContain("'updatedat', new.updated_at");
    expect(migration).toContain("'student-correspondence:' || new.recipient_id::text || ':' || v_recipient_token::text");
    expect(migration).toContain("function public.broadcast_student_correspondence_game_change()");
    expect(migration).toContain("'gameid', new.id");
    expect(migration).toContain("'student-correspondence:' || new.white_player_id::text || ':' || v_white_token::text");
    expect(migration).not.toMatch(/create\s+(table|function|trigger)[^;]*realtime\./);
  });

  it("keeps correspondence outside synchronous slots and rewards", () => {
    expect(migration).toContain("where game_mode = 'live' and status = 'active'");
    expect(migration).toContain("where g.game_mode = 'live' and g.status = 'active'");
    expect(migration).toContain("where game.game_mode = 'live' and game.status = 'active'");
    expect(migration).toContain("if new.game_mode = 'correspondence' then return new;");
    expect(migration).toContain("new.game_mode := v_game_mode");
  });

  it("preserves current four-character and legacy challenge codes", () => {
    expect(migration).toContain("extensions.gen_random_bytes(2)");
    expect(migration).toContain("p_challenge_code ~ '^[a-z0-9]{4}$'");
    expect(migration).toContain("p_challenge_code ~ '^[a-hj-np-z2-9]{12}$'");
  });

  it("restricts every public correspondence RPC to service role", () => {
    const rpcNames = [
      "ensure_student_correspondence_inbox(uuid)",
      "expire_student_correspondence_challenges(uuid)",
      "settle_correspondence_game_deadlines(uuid, uuid)",
      "create_student_correspondence_challenge(uuid, uuid)",
      "respond_student_correspondence_challenge(uuid, uuid, text)",
      "cancel_student_correspondence_challenge(uuid, uuid)",
      "mark_student_correspondence_challenges_seen(uuid, uuid[])"
    ];

    for (const signature of rpcNames) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated, service_role`
      );
      expect(migration).toContain(`grant execute on function public.${signature} to service_role`);
    }
  });
});
