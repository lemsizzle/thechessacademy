import type { BattleMode } from "./types";
export type TournamentEntry = { id: string; name: string; studentId: string | null; elo?: number | null };
export type TournamentResult = { winnerEntryId: string | null; scoreA: number; scoreB: number; reason: "played" | "bye" | "cancelled" };
export type TournamentMatch = { id: string; round: number; a: string; b: string | null; battleId: string | null; result: TournamentResult | null; scoreA: number; scoreB: number };
export type PuzzleTournament = { id: string; title: string; mode: BattleMode; duration: number; rounds: number; round: number; version: number; status: "waiting" | "active" | "finished" | "cancelled"; createdAt: string; roundStartsAt?: number | null; serverNow?: number; advanceError?: string; entries: TournamentEntry[]; matches: TournamentMatch[]; me?: string | null };
export type Standing = TournamentEntry & { points: number; wins: number; draws: number; losses: number; byes: number; played: number; rank: number };

export function tournamentStandings(t: Pick<PuzzleTournament, "entries" | "matches">): Standing[] {
  const rows = t.entries.map(e => ({ ...e, points: 0, wins: 0, draws: 0, losses: 0, byes: 0, played: 0, rank: 0 }));
  const byId = new Map(rows.map(e => [e.id, e]));
  for (const m of t.matches) {
    if (!m.result || m.result.reason === "cancelled") continue;
    for (const id of [m.a, m.b]) {
      const e = id && byId.get(id); if (!e) continue;
      e.played++;
      if (!m.b) { e.byes++; e.points += 2; }
      else if (!m.result.winnerEntryId) { e.draws++; e.points++; }
      else if (m.result.winnerEntryId === id) { e.wins++; e.points += 2; }
      else e.losses++;
    }
  }
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  rows.forEach((e, i) => { e.rank = i && rows[i-1].points === e.points ? rows[i-1].rank : i + 1; });
  return rows;
}

/** Score-group pairing, prioritizing opponents not played yet. No elimination. */
export function pairTournamentRound(t: Pick<PuzzleTournament, "entries" | "matches">): Array<[TournamentEntry, TournamentEntry | null]> {
  const remaining = tournamentStandings(t);
  const pairs: Array<[TournamentEntry, TournamentEntry | null]> = [];
  if (remaining.length % 2) {
    const bye = [...remaining].sort((a,b) => a.byes-b.byes || a.points-b.points || b.id.localeCompare(a.id))[0];
    remaining.splice(remaining.findIndex(e => e.id === bye.id), 1);
    pairs.push([bye, null]);
  }
  const repeats = (a: string, b: string) => t.matches.filter(m => (m.a === a && m.b === b) || (m.a === b && m.b === a)).length;
  while (remaining.length) {
    const a = remaining.shift()!;
    remaining.sort((b,c) => repeats(a.id,b.id)-repeats(a.id,c.id) || Math.abs(a.points-b.points)-Math.abs(a.points-c.points) || b.points-c.points || b.id.localeCompare(c.id));
    const b = remaining.shift()!;
    pairs.push([a,b]);
  }
  // Repair greedy dead ends with bounded two-pair swaps (at most 32 entrants).
  const points = new Map(tournamentStandings(t).map(e => [e.id,e.points]));
  const cost = (a: TournamentEntry,b: TournamentEntry) => repeats(a.id,b.id)*10000 + Math.abs(points.get(a.id)!-points.get(b.id)!);
  for (let pass=0;pass<pairs.length;pass++) {
    let improved=false;
    for(let i=0;i<pairs.length;i++) for(let j=i+1;j<pairs.length;j++) {
      const [a,b]=pairs[i], [c,d]=pairs[j]; if(!b || !d) continue;
      const old=cost(a,b)+cost(c,d);
      if(cost(a,c)+cost(b,d)<old) {pairs[i]=[a,c];pairs[j]=[b,d];improved=true;}
      else if(cost(a,d)+cost(b,c)<old) {pairs[i]=[a,d];pairs[j]=[b,c];improved=true;}
    }
    if(!improved) break;
  }
  // Existing battle engine keeps the human in slot zero against a bot.
  for(let i=0;i<pairs.length;i++) { const [a,b]=pairs[i]; if(b && !a.studentId && b.studentId) pairs[i]=[b,a]; }
  return pairs;
}
