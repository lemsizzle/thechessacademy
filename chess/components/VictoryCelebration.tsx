import type { CSSProperties } from "react";

const COLORS = ["#facc15", "#22d3ee", "#f472b6", "#a78bfa", "#34d399", "#fb923c"];
const CONFETTI = Array.from({ length: 34 }, (_, index) => ({
  color: COLORS[index % COLORS.length],
  delay: `${(index % 11) * 0.07}s`,
  drift: `${((index * 37) % 31) - 15}vw`,
  duration: `${2.25 + (index % 7) * 0.13}s`,
  left: `${2 + ((index * 29) % 96)}%`,
  rotation: `${180 + (index % 8) * 72}deg`,
  size: `${7 + (index % 4) * 3}px`
}));

type ConfettiStyle = CSSProperties & Record<`--${string}`, string>;

export function VictoryCelebration() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true" data-testid="victory-celebration">
      <div className="academy-victory-glow absolute inset-0" />
      <div className="academy-victory-banner absolute left-1/2 top-[10dvh] -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200/60 bg-slate-950/90 px-6 py-3 text-center shadow-[0_0_60px_rgba(250,204,21,.5)]">
        <span className="mr-2" aria-hidden="true">🏆</span>
        <span className="text-xl font-black uppercase tracking-[.12em] text-amber-100 sm:text-2xl">Victory!</span>
      </div>
      {CONFETTI.map((piece, index) => {
        const style: ConfettiStyle = {
          "--academy-confetti-drift": piece.drift,
          "--academy-confetti-rotation": piece.rotation,
          animationDelay: piece.delay,
          animationDuration: piece.duration,
          backgroundColor: piece.color,
          height: piece.size,
          left: piece.left,
          width: piece.size
        };
        return <span key={`${piece.left}-${index}`} className="academy-confetti absolute -top-4 rounded-sm" style={style} />;
      })}
    </div>
  );
}
