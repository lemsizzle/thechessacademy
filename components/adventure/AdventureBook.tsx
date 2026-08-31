"use client";

import { useState } from "react";
import { KNOWLEDGE_ENTRIES } from "@/adventure/content";
import type { AdventureProgress } from "@/adventure/types";
import { Button } from "@/components/Button";

export function AdventureBook({ progress, onClose, onPractice }: { progress: AdventureProgress; onClose: () => void; onPractice: (challengeId: string) => void }) {
  const [selectedId, setSelectedId] = useState("lem");
  const selected = KNOWLEDGE_ENTRIES.find((entry) => entry.id === selectedId) ?? KNOWLEDGE_ENTRIES[0];
  const unlocked = new Set(progress.unlockedKnowledgeIds);
  const practiceChallengeId = selected.practiceChallengeId;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/92 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-labelledby="lems-book-title">
      <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-amber-200/35 bg-[linear-gradient(135deg,rgba(120,53,15,.38),rgba(15,23,42,.98)_45%,rgba(8,47,73,.5))] shadow-[0_0_90px_rgba(245,158,11,.18)]">
        <div className="flex items-center justify-between gap-4 border-b border-amber-100/15 p-5 sm:p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-200">Lemicus, Keeper of Notes</p>
            <h2 id="lems-book-title" className="mt-1 text-3xl font-black text-white">Lem's Knowledge</h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>Close Book</Button>
        </div>
        <div className="grid min-h-[460px] md:grid-cols-[240px_1fr]">
          <nav className="border-b border-amber-100/10 bg-black/20 p-3 md:border-b-0 md:border-r" aria-label="Knowledge pages">
            <div className="grid grid-cols-2 gap-2 md:block md:space-y-2">
              {KNOWLEDGE_ENTRIES.map((entry) => {
                const isUnlocked = unlocked.has(entry.id);
                return <button key={entry.id} type="button" disabled={!isUnlocked} onClick={() => setSelectedId(entry.id)} className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selected.id === entry.id ? "border-amber-200/60 bg-amber-300/15" : "border-transparent hover:border-white/15 hover:bg-white/5"}`}>
                  <span className="mr-2" aria-hidden="true">{isUnlocked ? entry.icon : "🔒"}</span><span className="text-sm font-black text-white">{entry.title}</span>
                </button>;
              })}
            </div>
          </nav>
          <article className="flex flex-col justify-between p-6 sm:p-9">
            <div>
              <p className="text-4xl" aria-hidden="true">{selected.icon}</p>
              <h3 className="mt-4 text-3xl font-black text-white">{selected.title}</h3>
              <p className="mt-3 text-lg font-bold text-amber-100">{selected.summary}</p>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200">{selected.detail}</p>
            </div>
            {practiceChallengeId && <Button type="button" className="mt-8 w-fit" onClick={() => onPractice(practiceChallengeId)}>Practice Again</Button>}
          </article>
        </div>
      </section>
    </div>
  );
}
