import type { GameMove } from "@/chess/types";

export function MoveHistory({ moves }: { moves: GameMove[] }) {
  const rows: Array<{ number: number; white?: GameMove; black?: GameMove }> = [];
  for (const move of moves) {
    const number = Math.ceil(move.ply / 2);
    rows[number - 1] ??= { number };
    if (move.color === "white") rows[number - 1].white = move;
    else rows[number - 1].black = move;
  }

  return (
    <div className="scrollbar-soft max-h-64 overflow-y-auto rounded-md border border-white/10 bg-slate-950/65" aria-label="Move history">
      {rows.length ? (
        <ol className="divide-y divide-white/5 text-sm">
          {rows.map((row) => (
            <li key={row.number} className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 px-3 py-2">
              <span className="text-slate-500">{row.number}.</span>
              <span className="font-bold text-slate-100">{row.white?.san ?? ""}</span>
              <span className="font-bold text-slate-100">{row.black?.san ?? ""}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-slate-500">Moves will appear here in chess notation.</p>
      )}
    </div>
  );
}
