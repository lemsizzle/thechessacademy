"use client";

import type { ChessColor, PromotionPiece } from "@/chess/types";

const labels: Array<{ piece: PromotionPiece; label: string; white: string; black: string }> = [
  { piece: "q", label: "Queen", white: "♕", black: "♛" },
  { piece: "r", label: "Rook", white: "♖", black: "♜" },
  { piece: "b", label: "Bishop", white: "♗", black: "♝" },
  { piece: "n", label: "Knight", white: "♘", black: "♞" }
];

export function PromotionDialog({ color, onChoose, onCancel }: { color: ChessColor; onChoose: (piece: PromotionPiece) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-xl border border-amber-300/35 bg-slate-950 p-5 shadow-gold" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
        <h2 id="promotion-title" className="text-xl font-black text-white">Choose a promotion</h2>
        <p className="mt-1 text-sm text-slate-400">Which piece should your pawn become?</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {labels.map((item) => (
            <button key={item.piece} type="button" onClick={() => onChoose(item.piece)} className="rounded-lg border border-white/10 bg-white/5 p-4 text-center transition hover:border-amber-300/50 hover:bg-amber-300/10 active:scale-[.98]" aria-label={`Promote to ${item.label}`}>
              <span className="block text-5xl" aria-hidden="true">{color === "white" ? item.white : item.black}</span>
              <span className="mt-2 block text-sm font-black text-white">{item.label}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="mt-4 w-full rounded-md px-3 py-2 text-sm font-bold text-slate-400 hover:text-white">Cancel</button>
      </section>
    </div>
  );
}
