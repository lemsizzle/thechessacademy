"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Load the release notes and popup only when requested, outside gameplay bundles.
const StudentWhatsNewDialog = dynamic(() => import("./StudentWhatsNewDialog"), { ssr: false });

export function StudentWhatsNewButton({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-haspopup="dialog" onClick={() => { onOpen?.(); setOpen(true); }} className="min-h-10 shrink-0 rounded-lg border border-cyan-200/25 bg-cyan-200/5 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 sm:text-sm">
      What's new
    </button>
    {open ? <StudentWhatsNewDialog onClose={() => setOpen(false)} /> : null}
  </>;
}
