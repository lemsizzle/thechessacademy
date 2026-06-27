"use client";

import type { TournamentFilter } from "@/lib/tournaments/filterTournaments";

export function TournamentFilters({
  value,
  onChange,
  admin = false,
  hasCreatedBy = false
}: {
  value: TournamentFilter;
  onChange: (value: TournamentFilter) => void;
  admin?: boolean;
  hasCreatedBy?: boolean;
}) {
  const options: Array<{ value: TournamentFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "upcoming", label: "Upcoming" },
    { value: "ongoing", label: "Ongoing" },
    ...(admin ? [{ value: "finished" as const, label: "Finished" }] : []),
    ...(admin && hasCreatedBy ? [{ value: "created-by" as const, label: "Created By Config" }] : [])
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md border px-3 py-2 text-xs font-black transition active:translate-y-px active:scale-[0.98] ${value === option.value ? "border-cyan-200/60 bg-cyan-300/15 text-cyan-50" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
