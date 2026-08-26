"use client";

import type { CSSProperties } from "react";
import type { ChessColor } from "@/chess/types";

const PARTICLES = [
  { angle: 0, distance: 42, color: "#fde047", size: 7 },
  { angle: 32, distance: 50, color: "#fb7185", size: 6 },
  { angle: 64, distance: 38, color: "#67e8f9", size: 8 },
  { angle: 98, distance: 52, color: "#fbbf24", size: 5 },
  { angle: 132, distance: 44, color: "#f472b6", size: 7 },
  { angle: 166, distance: 50, color: "#a5f3fc", size: 6 },
  { angle: 202, distance: 40, color: "#fde047", size: 8 },
  { angle: 236, distance: 54, color: "#fb7185", size: 5 },
  { angle: 270, distance: 46, color: "#67e8f9", size: 7 },
  { angle: 304, distance: 52, color: "#fbbf24", size: 6 },
  { angle: 336, distance: 39, color: "#f472b6", size: 8 }
] as const;

type ParticleStyle = CSSProperties & {
  "--academy-capture-x": string;
  "--academy-capture-y": string;
  "--academy-capture-rotation": string;
};

function squarePosition(square: string, orientation: ChessColor) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  return { left: `${(column + 0.5) * 12.5}%`, top: `${(row + 0.5) * 12.5}%` };
}

export function BoardCaptureParticles({ effect, orientation }: { effect: { id: number; square: string } | null; orientation: ChessColor }) {
  if (!effect) return null;
  const position = squarePosition(effect.square, orientation);

  return (
    <div key={effect.id} className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-lg" aria-hidden="true">
      <div className="absolute h-0 w-0" style={position}>
        <span className="academy-capture-flash absolute left-1/2 top-1/2 h-12 w-12 rounded-full border-2 border-amber-200 bg-amber-200/35" />
        {PARTICLES.map((particle, index) => {
          const radians = particle.angle * Math.PI / 180;
          const style: ParticleStyle = {
            width: particle.size,
            height: particle.size,
            color: particle.color,
            backgroundColor: particle.color,
            animationDelay: `${index * 7}ms`,
            "--academy-capture-x": `${Math.cos(radians) * particle.distance}px`,
            "--academy-capture-y": `${Math.sin(radians) * particle.distance}px`,
            "--academy-capture-rotation": `${particle.angle + 135}deg`
          };
          return <span key={particle.angle} className="academy-capture-particle absolute left-1/2 top-1/2 rounded-[2px] shadow-[0_0_8px_currentColor]" style={style} />;
        })}
      </div>
    </div>
  );
}
