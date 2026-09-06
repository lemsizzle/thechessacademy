"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getBadgeTierStyles, getTierAura } from "@/lib/badges";
import type { Badge } from "@/lib/types";

function getFallbackBadgeArtUrl(badge: Badge) {
  const variant = (badge.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3) + 1;
  const params = new URLSearchParams({ badge: badge.name, category: badge.category });
  return `/mock-badge-art/${badge.tier?.toLowerCase() ?? "concept"}-${variant}.svg?${params.toString()}`;
}

export function BadgeCard({ badge, earned = false, statusText }: { badge: Badge; earned?: boolean; statusText?: string }) {
  const [open, setOpen] = useState(false);
  const tierStyles = getBadgeTierStyles(badge.tier);
  const aura = getTierAura(badge.tier);
  const imageUrl = badge.finalImageUrl || badge.artImageUrl || getFallbackBadgeArtUrl(badge);
  return (
    <>
      <button
        type="button"
        aria-label={`View ${badge.name} badge details`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`group relative grid aspect-square min-w-0 place-items-center overflow-hidden rounded-2xl border p-3 transition hover:border-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950 sm:p-5 ${tierStyles} ${earned ? "" : "grayscale opacity-55"}`}
      >
        <span className={`block aspect-square w-full max-w-48 rounded-full bg-gradient-to-br ${aura} p-1 shadow-glow transition-transform motion-safe:group-hover:scale-105 motion-safe:group-active:scale-95`}>
          <img src={imageUrl} alt="" width={192} height={192} loading="lazy" decoding="async" className="h-full w-full rounded-full bg-slate-950 object-contain" />
        </span>
      </button>
      {open && <BadgeDetails badge={badge} imageUrl={imageUrl} statusText={statusText ?? (earned ? "Earned" : "Locked")} onClose={() => setOpen(false)} />}
    </>
  );
}

function BadgeDetails({ badge, imageUrl, statusText, onClose }: { badge: Badge; imageUrl: string; statusText: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "Tab") {
          // The close button is the only control in this artwork viewer.
          event.preventDefault();
          dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/85 backdrop:backdrop-blur-sm"
    >
      <div className="relative p-5 sm:p-8">
        <button type="button" autoFocus onClick={onClose} aria-label="Close badge details" className="absolute right-3 top-3 grid size-11 place-items-center rounded-full border border-white/15 bg-slate-950 text-2xl hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">×</button>
        <div className={`mx-auto mt-8 aspect-square w-full max-w-72 rounded-full bg-gradient-to-br ${getTierAura(badge.tier)} p-1.5 shadow-glow`}>
          <img src={imageUrl} alt={`${badge.name} badge art`} width={288} height={288} className="h-full w-full rounded-full bg-slate-950 object-contain" />
        </div>
        <h2 id={titleId} className="mt-6 break-words text-center text-2xl font-black text-white">{badge.name}</h2>
        <p className="mt-2 text-center text-sm text-cyan-100">{statusText}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-bold">
          {badge.tier && <span className={`rounded-full border px-3 py-1 ${getBadgeTierStyles(badge.tier)}`}>{badge.tier}</span>}
          <span className="rounded-full bg-white/10 px-3 py-1">{badge.category}</span>
          <span className="rounded-full bg-white/10 px-3 py-1">{badge.xpValue} XP</span>
        </div>
        {badge.description && <p className="mt-5 break-words text-sm leading-relaxed text-slate-300">{badge.description}</p>}
        {badge.unlockRequirement && <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"><h3 className="text-sm font-bold text-white">How to earn it</h3><p className="mt-1 break-words text-sm leading-relaxed text-slate-300">{badge.unlockRequirement}</p></div>}
      </div>
    </dialog>
  );
}
