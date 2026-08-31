import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260831154500_add_explicit_live_rematch_decisions.sql"),
  "utf8"
).toLowerCase().replace(/\s+/g, " ");

describe("explicit live rematch decisions migration", () => {
  it("serializes and version-checks every rematch decision", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("p_expected_version <> v_game.version");
    expect(migration).toContain("v_decision not in ('request', 'accept', 'decline')");
  });

  it("lets only the invited opponent accept or decline", () => {
    expect(migration).toContain("only your opponent can respond to your rematch request");
    expect(migration).toContain("if v_decision = 'decline'");
    expect(migration).toContain("set rematch_requested_by = null");
  });

  it("keeps the resolver server-only with an empty search path", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon, authenticated, service_role");
    expect(migration).toContain("to service_role");
  });
});
