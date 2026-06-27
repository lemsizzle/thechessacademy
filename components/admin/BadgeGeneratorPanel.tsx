"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { buildBadgeImagePrompt, getMockBadgeArtOptions } from "@/lib/badges";
import type { Badge } from "@/lib/types";
import { useMemo, useState } from "react";

export function BadgeGeneratorPanel({ badge, onSave }: { badge: Badge; onSave?: (imageUrl: string) => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready" | "saved">(badge.finalImageUrl ? "saved" : "idle");
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(badge.finalImageUrl);
  const prompt = useMemo(() => buildBadgeImagePrompt(badge), [badge]);

  function generate() {
    setStatus("loading");
    window.setTimeout(() => {
      try {
        setOptions(getMockBadgeArtOptions(badge));
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }, 700);
  }

  function saveSelection() {
    if (!selected) {
      setStatus("error");
      return;
    }
    onSave?.(selected);
    setStatus("saved");
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black text-white">AI Badge Art</h3>
          <p className="text-sm text-slate-400">Mock generation now. Later this calls a server route with OpenAI and stores the result in Supabase Storage.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={generate} disabled={status === "loading"}>{selected ? "Regenerate Badge Art" : "Generate Badge Art"}</Button>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
        <summary className="cursor-pointer font-bold text-slate-200">Prompt preview</summary>
        <p className="mt-2 leading-relaxed">{prompt}</p>
      </details>

      {status === "loading" && <p className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">Generating three mock badge options...</p>}
      {status === "error" && <p className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 p-3 text-sm text-red-100">Generation needs a selected option. Try again or choose one of the mock results.</p>}
      {status === "saved" && selected && <p className="mt-4 rounded-md border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">Selected badge art saved in local component state for this mock version.</p>}

      {options.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => setSelected(option)}
              className={`rounded-lg border p-3 text-left transition ${selected === option ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
            >
              <img src={option} alt={`Generated mock option ${index + 1}`} className="mx-auto aspect-square w-28 rounded-full" />
              <p className="mt-2 text-center text-xs font-bold text-slate-200">Option {index + 1}</p>
            </button>
          ))}
        </div>
      )}

      {options.length > 0 && <Button className="mt-4" onClick={saveSelection}>Save Selected Art</Button>}
    </Card>
  );
}
