// Offline authoring tool: deterministic, small teaching positions, checked
// against legal chess moves before being committed as a fixed 180-puzzle set.
import { Chess, type PieceSymbol, type Square } from "chess.js";
import { writeFileSync } from "node:fs";
import { acceptedLearnMoves, kingSquare, sameRay } from "../lib/learn/rules";
import type { LearnPosition, LearnPuzzle, LearnTopicId } from "../lib/learn/types";

let seed = 20261123;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
const sq = (x: number, y: number) => x < 0 || x > 7 || y < 0 || y > 7 ? null : String.fromCharCode(97 + x) + (y + 1);
const xy = (square: string) => [square.charCodeAt(0) - 97, Number(square[1]) - 1];
const squares = Array.from({ length: 64 }, (_, i) => sq(i % 8, Math.floor(i / 8))!);
type Entry = [string, string];
function fen(entries: Entry[]) {
  if (new Set(entries.map(entry => entry[1])).size !== entries.length) return null;
  const board = new Chess(); board.clear();
  for (const [piece, square] of entries) {
    if (!square || (piece.toLowerCase() === "p" && /[18]$/.test(square))) return null;
    if (!board.put({ type: piece.toLowerCase() as PieceSymbol, color: piece === piece.toUpperCase() ? "w" : "b" }, square as Square)) return null;
  }
  return board.fen();
}
const result: LearnPuzzle[] = [], used = new Set<string>();
function accept(topic: LearnTopicId, kind: string, entries: Entry[], target?: string, focus?: string) {
  const value = fen(entries);
  if (!value || used.has(value)) return false;
  const game = new Chess(value);
  if (game.isAttacked(kingSquare(game, "b"), "w") || game.isGameOver()) return false;
  const checkLesson = topic === "defensive-move" && kind !== "escape";
  if (game.isCheck() !== checkLesson) return false;
  if (topic === "hanging-piece" && game.isAttacked(target as Square, "b")) return false;
  if (kind === "escape" && !game.isAttacked(focus as Square, "b")) return false;
  if (topic === "pins" && game.board().flat().some(piece => piece?.color === "w" && sameRay(piece.square, target!, kingSquare(game, "b"), piece.type) && game.attackers(target as Square, "w").includes(piece.square))) return false;
  const position: LearnPosition = { topic, kind, fen: value, ...(target ? { target } : {}), ...(focus ? { focus } : {}) };
  const solutions = acceptedLearnMoves(position);
  if (!solutions.length) return false;
  used.add(value);
  result.push({ id: `${topic}-${String(result.filter(p => p.topic === topic).length + 1).padStart(2, "0")}`, ...position, solutions });
  return true;
}
function batch(topic: LearnTopicId, kind: string, count: number, generate: () => { entries: Entry[]; target?: string; focus?: string } | null) {
  let accepted = 0;
  for (let tries = 0; accepted < count && tries < 100_000; tries++) {
    const candidate = generate();
    if (candidate && accept(topic, kind, candidate.entries, candidate.target, candidate.focus)) accepted++;
  }
  if (accepted !== count) throw new Error(`${topic}/${kind}: only ${accepted}/${count}`);
  console.log(`${topic}/${kind}: ${accepted}`);
}
const mirror = (entries: Entry[]) => random() < .5 ? entries : entries.map(([p, s]): Entry => [p, sq(7 - xy(s)[0], xy(s)[1])!]);
batch("mate-in-one", "queen-and-king", 10, () => ({ entries: mirror([["K", pick(["f6", "f7", "f8"])], ["k", "h8"], ["Q", pick(squares)]]) }));
batch("mate-in-one", "back-rank", 10, () => ({ entries: mirror([["K", "a1"], ["k", "h8"], [pick(["R", "Q"]), pick(squares)], ["p", "g7"], ["p", "h7"]]) }));
batch("mate-in-one", "smothered-knight", 10, () => ({ entries: mirror([["K", "a1"], ["k", "h8"], ["r", "g8"], ["p", "g7"], ["p", "h7"], ["N", pick(squares)]]) }));

for (const piece of ["P", "N", "B", "R", "Q"]) batch("hanging-piece", piece.toLowerCase(), 6, () => {
  const target = pick(squares.filter(s => /[3-6]$/.test(s)));
  return { target, entries: [["K", "a1"], ["k", "h8"], [piece, pick(squares)], [pick(["q", "r", "b", "n"]), target]] };
});
batch("defensive-move", "escape", 10, () => {
  const focus = pick(squares.filter(s => /[3-6]$/.test(s)));
  return { focus, entries: [["K", "a1"], ["k", "h8"], [pick(["R", "B", "N", "Q"]), focus], [pick(["r", "b", "n"]), pick(squares)]] };
});
batch("defensive-move", "block", 10, () => {
  const file = pick([1, 2, 3, 4, 5]);
  return { entries: [["K", sq(file, 0)!], ["k", "h8"], ["r", sq(file, 6)!], [pick(["R", "B", "N"]), pick(squares)]] };
});
batch("defensive-move", "capture-checker", 10, () => {
  const target = pick(["a2", "b1", "d1", "e2", "a4", "b5", "d5", "e4"]);
  return { target, entries: [["K", "c3"], ["k", "h8"], ["n", target], [pick(["R", "B", "Q"]), pick(squares)]] };
});

const knightOffsets = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
batch("forks", "knight", 18, () => {
  const [x,y] = xy(pick(squares)), hits = knightOffsets.map(([dx,dy]) => sq(x+dx,y+dy)).filter(Boolean) as string[];
  if (hits.length < 3) return null;
  const king = pick(hits), target = pick(hits.filter(s => s !== king)), from = pick(hits.filter(s => s !== king && s !== target));
  return { target, entries: [["K", pick(["a1", "h1", "a2", "h2"])], ["k", king], ["N", from], [pick(["q", "r"]), target]] };
});
batch("forks", "pawn", 6, () => {
  const x = pick([2,3,4,5]), y = pick([3,4,5]), leftKing = random() < .5;
  const king = sq(x+(leftKing ? -1 : 1),y+1)!, target = sq(x+(leftKing ? 1 : -1),y+1)!;
  return { target, entries: [["K", sq(x+(leftKing ? -1 : 1),y-1)!], ["k", king], ["P", sq(x,y-1)!], ["r", target]] };
});
batch("forks", "queen", 6, () => {
  const target = pick(squares);
  return { target, entries: [["K", "a1"], ["k", pick(squares.filter(s => /[6-8]$/.test(s)))], ["Q", pick(squares)], ["n", target]] };
});

for (const piece of ["R", "B", "Q"]) for (const topic of ["pins", "skewers"] as const) batch(topic, piece.toLowerCase(), 10, () => {
  const [x,y] = xy(pick(squares)), straight = pick([[1,0],[-1,0],[0,1],[0,-1]]), diagonal = pick([[1,1],[1,-1],[-1,1],[-1,-1]]);
  const [dx,dy] = piece === "B" ? diagonal : piece === "R" ? straight : pick([straight, diagonal]);
  const length = pick([3,4,5,6]), middle = pick(Array.from({length: length - 2}, (_,i) => i+2));
  const front = sq(x+dx*middle,y+dy*middle), back = sq(x+dx*length,y+dy*length);
  if (!front || !back) return null;
  const target = topic === "pins" ? front : back, king = topic === "pins" ? back : front;
  const victim = topic === "pins" ? pick(["n", dx && dy ? "r" : "b"]) : pick(["q", "r"]);
  return { target, entries: [["K", pick(["a1","h1","a8","h8"])], ["k", king], [victim, target], [piece, pick(squares)]] };
});

writeFileSync("lib/learn/puzzles.json", JSON.stringify(result, null, 2) + "\n");
console.log(`Wrote ${result.length} unique teaching positions.`);
