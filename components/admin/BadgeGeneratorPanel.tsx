"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { buildBadgeImagePrompt } from "@/lib/badges";
import type { Badge } from "@/lib/types";
import { useMemo, useState } from "react";

export function BadgeGeneratorPanel({ badge, adminActionToken, onSave }: { badge: Badge; adminActionToken?: string; onSave?: (imageUrl: string) => void | Promise<void> }) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready" | "saved">(badge.finalImageUrl ? "saved" : "idle");
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(badge.finalImageUrl);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const prompt = useMemo(() => buildBadgeImagePrompt(badge), [badge]);

  async function generate() {
    setStatus("loading");
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/badges/generate-art", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(adminActionToken ? { "x-admin-action-token": adminActionToken } : {})
        },
        body: JSON.stringify({ badge, prompt })
      });
      const data = await response.json().catch(() => ({})) as { options?: string[]; error?: string; mode?: string; message?: string };
      if (!response.ok || !data.options?.length) {
        throw new Error(data.error ?? "No badge art options were generated.");
      }
      setOptions(data.options);
      setSelected(data.options[0] ?? null);
      setMessage(data.message ?? (data.mode === "openai" ? "Generated with OpenAI image generation." : "Generated mock badge art options."));
      setStatus("ready");
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Badge art generation failed.");
      setStatus("error");
    }
  }

  async function saveSelection() {
    if (!selected) {
      setError("Choose one generated option before saving.");
      setStatus("error");
      return;
    }
    await onSave?.(selected);
    setMessage("Selected badge art saved to the badge record.");
    setStatus("saved");
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black text-white">ChatGPT Badge Art</h3>
          <p className="text-sm text-slate-400">Generate options from the server so future OpenAI keys stay private.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={generate} disabled={status === "loading"}>{selected ? "Regenerate Badge Art" : "Generate Badge Art"}</Button>
        </div>
      </div>

      <details className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-400">
        <summary className="cursor-pointer font-bold text-slate-200">Prompt sent to image generator</summary>
        <p className="mt-2 leading-relaxed">{prompt}</p>
      </details>

      {status === "loading" && <p className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">Generating three badge options...</p>}
      {status === "error" && <p className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 p-3 text-sm text-red-100">{error || "Generation failed."}</p>}
      {message && status !== "error" && <p className="mt-4 rounded-md border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</p>}

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
