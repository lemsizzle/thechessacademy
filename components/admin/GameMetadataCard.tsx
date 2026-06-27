import { Card } from "@/components/Card";
import type { LichessGame } from "@/lib/types";

export function GameMetadataCard({ game, mode }: { game: LichessGame; mode: "connected" | "mock" }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-black text-white">Game Metadata</h2>
          <a className="mt-1 block text-sm font-bold text-cyan-100 hover:underline" href={game.url} target="_blank" rel="noreferrer">{game.url}</a>
        </div>
        <span className="w-fit rounded bg-white/10 px-2 py-1 text-xs font-black uppercase text-slate-200">{mode}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">White</p>
          <p className="mt-1 font-black text-white">{game.whiteUsername}</p>
          <p className="text-xs text-slate-400">{game.whiteRating ?? "Unrated"}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">Black</p>
          <p className="mt-1 font-black text-white">{game.blackUsername}</p>
          <p className="text-xs text-slate-400">{game.blackRating ?? "Unrated"}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">Game</p>
          <p className="mt-1 font-black text-white">{game.perfType ?? game.speed ?? "Unknown"}</p>
          <p className="text-xs text-slate-400">{game.rated ? "Rated" : "Casual"}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-bold uppercase text-slate-400">Result</p>
          <p className="mt-1 font-black text-white">{game.result ?? "Unknown"}</p>
          <p className="text-xs text-slate-400">{game.opening ?? "Opening unknown"}</p>
        </div>
      </div>
    </Card>
  );
}
