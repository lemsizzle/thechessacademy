"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getNavigationGroups, type NavVariant } from "@/components/navigation";
import { TournamentLiveIndicator } from "@/components/TournamentLiveIndicator";

const SIDEBAR_STORAGE_KEY = "academy-sidebar-collapsed:v1";

export function Sidebar({ variant = "public" }: { variant?: NavVariant }) {
  const groups = getNavigationGroups(variant);
  const homeHref = variant === "student" ? "/student" : variant === "admin" ? "/admin" : "/";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    } catch {
      // A blocked preference store should not prevent navigation.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <aside className={`scrollbar-soft sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-white/10 bg-slate-950/70 transition-[width,padding] duration-200 md:block ${collapsed ? "w-20 p-2" : "w-56 p-3 lg:w-64 lg:p-4"}`}>
      <div className="flex items-start gap-1.5">
        <Link
          href={homeHref}
          aria-label="Chess Academy Quest Board"
          title={collapsed ? "Quest Board" : undefined}
          className={`min-w-0 flex-1 rounded-lg border border-amber-300/20 bg-amber-300/10 ${collapsed ? "grid h-10 place-items-center p-1 text-sm font-black text-amber-100" : "block p-4"}`}
        >
          {collapsed ? "CA" : (
            <>
              <p className="text-xs font-bold uppercase text-amber-100">Chess Academy</p>
              <p className="mt-1 text-lg font-black text-white">Quest Board</p>
            </>
          )}
        </Link>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={`${variant}-sidebar-navigation`}
          aria-label={collapsed ? "Expand side navigation" : "Collapse side navigation"}
          title={collapsed ? "Expand" : "Collapse"}
          onClick={toggleCollapsed}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>
      <nav id={`${variant}-sidebar-navigation`} aria-label={`${variant} navigation`} className={`${collapsed ? "mt-4 space-y-4" : "mt-6 space-y-5"}`}>
        {groups.map((group, index) => (
          <div key={group.title ?? `group-${index}`}>
            {group.title && !collapsed ? <p className="mb-2 px-3 text-xs font-black uppercase text-slate-500">{group.title}</p> : null}
            <div className="space-y-1">
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                  className={`relative flex min-h-10 items-center rounded-md text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${collapsed ? "justify-center px-1 py-2" : "gap-3 px-3 py-2"}`}
                >
                  {link.icon ? <span aria-hidden="true" className="flex w-6 justify-center text-base">{link.icon}</span> : null}
                  <span className={collapsed ? "sr-only" : undefined}>{link.label}</span>
                  {link.href.endsWith("/tournaments") ? <TournamentLiveIndicator compact={collapsed} /> : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
