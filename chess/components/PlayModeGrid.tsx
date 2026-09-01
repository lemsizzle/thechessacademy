"use client";

import Link from "next/link";
import { RouteLauncherDialog, useCloseRouteLauncher } from "@/components/student/RouteLauncherDialog";

function PlayChoices() {
  const closeLauncher = useCloseRouteLauncher();

  function showComputerGame() {
    closeLauncher();
    window.requestAnimationFrame(() => {
      document.getElementById("computer-game")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={showComputerGame}
          className="group flex min-h-40 flex-col items-start justify-between rounded-xl border border-amber-300/25 bg-amber-300/[0.08] p-5 text-left transition hover:-translate-y-0.5 hover:border-amber-200/55 hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          <span aria-hidden="true" className="text-4xl">♟️</span>
          <span>
            <span className="block text-xl font-black text-white">Computer</span>
            <span className="mt-1 block text-sm text-slate-300">Choose a bot and play right away.</span>
          </span>
        </button>
        <Link
          href="/student/play/live"
          className="group flex min-h-40 flex-col items-start justify-between rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] p-5 transition hover:-translate-y-0.5 hover:border-cyan-200/55 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          <span aria-hidden="true" className="text-4xl">⚡</span>
          <span>
            <span className="block text-xl font-black text-white">Classmate</span>
            <span className="mt-1 block text-sm text-slate-300">Create or join a live student game.</span>
          </span>
        </Link>
      </div>
      <Link
        href="/student/play/correspondence"
        className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
      >
        <span><span aria-hidden="true" className="mr-2">↻</span>Continue a game</span>
        <span aria-hidden="true" className="text-slate-500">→</span>
      </Link>
    </div>
  );
}

export function PlayModeGrid() {
  return (
    <RouteLauncherDialog
      id="student-play-launcher"
      eyebrow="Play"
      title="Choose an opponent"
      description="Play a bot or challenge a classmate."
      triggerLabel="Choose how to play"
      triggerDescription="Computer, classmate, or continue a game."
    >
      <PlayChoices />
    </RouteLauncherDialog>
  );
}
