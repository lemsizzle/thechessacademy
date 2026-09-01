"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getNavigationGroups,
  getStudentMoreLinks,
  getStudentNavigationHubs,
  type NavLink,
  type NavVariant
} from "@/components/navigation";
import { TournamentLiveIndicator } from "@/components/TournamentLiveIndicator";

const SIDEBAR_STORAGE_KEY = "academy-sidebar-collapsed:v1";

function routePath(href: string) {
  return href.split("?")[0] ?? href;
}

function isRouteWithin(pathname: string, href: string) {
  if (href.includes("?")) return false;
  const target = routePath(href);
  if (target === "/student" || target === "/admin" || target === "/") return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}

function SidebarLink({
  link,
  collapsed,
  active = false,
  branch = false
}: {
  link: NavLink;
  collapsed: boolean;
  active?: boolean;
  branch?: boolean;
}) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? link.label : undefined}
      className={`relative flex items-center rounded-md font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${collapsed ? "min-h-10 justify-center px-1 py-2 text-sm" : branch ? "min-h-9 gap-2 px-2 py-1.5 text-xs" : "min-h-11 gap-3 border px-3 py-2.5 text-sm"} ${active ? "border-cyan-200/30 bg-cyan-200/12 text-cyan-100" : branch ? "text-slate-400 hover:bg-white/[0.08] hover:text-white" : "border-white/[0.08] bg-white/[0.035] text-slate-200 hover:border-white/15 hover:bg-white/10 hover:text-white"}`}
    >
      {link.icon ? <span aria-hidden="true" className="flex w-6 justify-center text-base">{link.icon}</span> : null}
      <span className={collapsed ? "sr-only" : undefined}>{link.label}</span>
      {link.href.endsWith("/tournaments") ? <TournamentLiveIndicator compact={collapsed} /> : null}
    </Link>
  );
}

export function Sidebar({ variant = "public" }: { variant?: NavVariant }) {
  const pathname = usePathname();
  const groups = getNavigationGroups(variant);
  const studentHubs = variant === "student" ? getStudentNavigationHubs() : [];
  const studentMoreLinks = variant === "student" ? getStudentMoreLinks() : [];
  const homeHref = variant === "student" ? "/student" : variant === "admin" ? "/admin" : "/";
  const [collapsed, setCollapsed] = useState(false);
  const [studentMoreOpen, setStudentMoreOpen] = useState(false);
  const studentMoreActive = studentMoreLinks.some((link) => isRouteWithin(pathname, link.href));

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    } catch {
      // A blocked preference store should not prevent navigation.
    }
  }, []);

  useEffect(() => {
    setStudentMoreOpen(studentMoreActive);
  }, [studentMoreActive]);

  function saveCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }

  function toggleCollapsed() {
    saveCollapsed(!collapsed);
  }

  function openStudentMore() {
    saveCollapsed(false);
    setStudentMoreOpen(true);
  }

  return (
    <aside className={`scrollbar-soft sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-white/10 bg-slate-950/70 transition-[width,padding] duration-200 md:block ${collapsed ? "w-20 p-2" : "w-56 p-3 lg:w-64 lg:p-4"}`}>
      <div className={`flex items-start ${collapsed ? "justify-center gap-1" : "gap-1.5"}`}>
        <Link
          href={homeHref}
          aria-label="Chess Academy Quest Board"
          title={collapsed ? "Quest Board" : undefined}
          className={`rounded-lg border border-amber-300/20 bg-amber-300/10 ${collapsed ? "grid size-8 shrink-0 place-items-center text-amber-100" : "min-w-0 flex-1 p-4"}`}
        >
          {collapsed ? <span aria-hidden="true">♔</span> : (
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
          className={`grid shrink-0 place-items-center rounded-md border border-white/10 bg-white/5 text-lg font-black text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${collapsed ? "size-8" : "size-9"}`}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>
      <nav id={`${variant}-sidebar-navigation`} aria-label={`${variant} navigation`} className={`${collapsed ? "mt-4 space-y-4" : "mt-6 space-y-5"}`}>
        {variant === "student" ? (
          <>
            {studentHubs.map((hub) => (
              <div key={hub.href} className={collapsed ? undefined : "space-y-1.5"}>
                <SidebarLink link={hub} collapsed={collapsed} active={isRouteWithin(pathname, hub.href) || hub.branches.some((branch) => isRouteWithin(pathname, branch.href))} />
                {!collapsed && hub.branches.length > 0 ? (
                  <div className="ml-5 space-y-1 border-l border-white/10 pl-2" aria-label={`${hub.label} pages`}>
                    {hub.branches.map((branch) => (
                      <SidebarLink key={branch.href} link={branch} collapsed={false} branch active={isRouteWithin(pathname, branch.href)} />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {collapsed ? (
              <button
                type="button"
                aria-label="Open more navigation"
                title="More"
                onClick={openStudentMore}
                className="grid min-h-10 w-full place-items-center rounded-md text-lg font-black tracking-widest text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
              >
                <span aria-hidden="true">•••</span>
              </button>
            ) : (
              <div className="border-t border-white/10 pt-3">
                <button
                  type="button"
                  aria-expanded={studentMoreOpen}
                  aria-controls="student-sidebar-more"
                  onClick={() => setStudentMoreOpen((current) => !current)}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 ${studentMoreActive ? "bg-cyan-200/12 text-cyan-100" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
                >
                  <span aria-hidden="true" className="flex w-6 justify-center tracking-widest">•••</span>
                  <span>More</span>
                  <span aria-hidden="true" className="ml-auto text-xs">{studentMoreOpen ? "▲" : "▼"}</span>
                </button>
                {studentMoreOpen ? (
                  <div id="student-sidebar-more" className="mt-1 ml-5 space-y-1 border-l border-white/10 pl-2">
                    {studentMoreLinks.map((link) => (
                      <SidebarLink key={link.href} link={link} collapsed={false} branch active={isRouteWithin(pathname, link.href)} />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : groups.map((group, index) => (
          <div key={group.title ?? `group-${index}`}>
            {group.title && !collapsed ? <p className="mb-2 px-3 text-xs font-black uppercase text-slate-500">{group.title}</p> : null}
            <div className="space-y-1">
              {group.links.map((link) => (
                <SidebarLink key={link.href} link={link} collapsed={collapsed} active={isRouteWithin(pathname, link.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
