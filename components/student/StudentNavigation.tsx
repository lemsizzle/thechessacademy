"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  getStudentMobileMoreGroups,
  getStudentMobilePrimaryLinks,
  getStudentMoreLinks,
  getStudentNavigationHubs,
  type NavLink,
  type StudentNavHub
} from "@/components/navigation";

type OpenMenu = "account" | "more" | null;

const primaryLinks = getStudentMobilePrimaryLinks();
const navigationHubs = getStudentNavigationHubs();
const moreGroups = getStudentMobileMoreGroups();
const standaloneMoreLinks = getStudentMoreLinks();

function isRouteWithin(pathname: string, href: string) {
  if (href === "/student") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isHubActive(pathname: string, hub: StudentNavHub) {
  return isRouteWithin(pathname, hub.href) || hub.branches.some((branch) => isRouteWithin(pathname, branch.href));
}

function NavigationIcon({ href }: { href: string }) {
  const commonProps = {
    "aria-hidden": true,
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24"
  };

  if (href === "/student") {
    return <svg {...commonProps}><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>;
  }
  if (href === "/student/training") {
    return <svg {...commonProps}><path d="M9 3v4H5v4H2v8h8v-3h4v3h8v-8h-3V7h-4V3z" /></svg>;
  }
  if (href === "/student/play") {
    return <span aria-hidden="true" className="text-lg leading-none">▶️</span>;
  }
  if (href === "/student/quests") {
    return <svg {...commonProps}><path d="M6 3h12v18l-6-3-6 3zM9 8h6M9 12h4" /></svg>;
  }
  if (href === "/student/avatar") {
    return <svg {...commonProps}><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6M8 4l1.5-2L12 4l2.5-2L16 4" /></svg>;
  }
  return <svg {...commonProps}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
}

function focusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
}

function MobileLink({ link, active, onSelect }: { link: NavLink; active: boolean; onSelect?: () => void }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      onClick={onSelect}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-[0.68rem] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 ${active ? "bg-cyan-200/12 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
    >
      <NavigationIcon href={link.href} />
      <span className="text-center leading-tight">{link.label}</span>
    </Link>
  );
}

export function StudentNavigation({ studentName, onLogout }: { studentName: string; onLogout: () => void }) {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreDialogRef = useRef<HTMLElement>(null);
  const moreRouteActive = standaloneMoreLinks.some((link) => isRouteWithin(pathname, link.href));
  const initial = studentName.trim().charAt(0).toUpperCase() || "S";

  function closeMenu({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
    const previousMenu = openMenu;
    setOpenMenu(null);
    if (!restoreFocus) return;
    window.requestAnimationFrame(() => {
      if (previousMenu === "account") accountButtonRef.current?.focus();
      if (previousMenu === "more") moreButtonRef.current?.focus();
    });
  }

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;
    const target = openMenu === "account" ? accountMenuRef.current : moreDialogRef.current;
    window.requestAnimationFrame(() => focusableElements(target)[0]?.focus());

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (openMenu !== "account") return;
      const targetNode = event.target as Node;
      if (!accountMenuRef.current?.contains(targetNode) && !accountButtonRef.current?.contains(targetNode)) closeMenu({ restoreFocus: false });
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    const previousOverflow = document.body.style.overflow;
    if (openMenu === "more") document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openMenu]);

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(moreDialogRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/student" className="min-w-0 font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80">
            <span className="sm:hidden">Chess Academy</span>
            <span className="hidden sm:inline">The Chess Academy Quest Board</span>
          </Link>
          <div className="relative">
            <button
              ref={accountButtonRef}
              type="button"
              aria-label={`Open account menu for ${studentName}`}
              aria-expanded={openMenu === "account"}
              aria-controls="student-account-menu"
              onClick={() => setOpenMenu((current) => current === "account" ? null : "account")}
              className="flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-sm font-bold text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
            >
              <span className="grid size-8 place-items-center rounded-full bg-cyan-200/15 text-sm font-black text-cyan-100" aria-hidden="true">{initial}</span>
              <span className="hidden max-w-32 truncate sm:inline">{studentName}</span>
              <span className="text-slate-400" aria-hidden="true">⌄</span>
            </button>
            {openMenu === "account" ? (
              <div
                ref={accountMenuRef}
                id="student-account-menu"
                role="menu"
                aria-label="Account"
                className="absolute right-0 top-12 z-50 w-60 rounded-lg border border-white/10 bg-slate-950 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
              >
                <p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Signed in as</p>
                <p className="truncate px-3 pb-3 text-sm font-black text-white">{studentName}</p>
                <div className="border-t border-white/10 pt-2">
                  <Link
                    role="menuitem"
                    href="/student"
                    onClick={() => closeMenu({ restoreFocus: false })}
                    className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-bold text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
                  >
                    Dashboard
                  </Link>
                  <button role="menuitem" type="button" onClick={onLogout} className="w-full rounded-md px-3 py-2.5 text-left text-sm font-bold text-rose-200 hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/80">
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <nav aria-label="Primary student navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-2 pt-1.5 shadow-[0_-12px_32px_rgba(2,6,23,0.45)] backdrop-blur md:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-lg gap-1">
          {primaryLinks.map((link) => (
            <MobileLink
              key={link.href}
              link={link}
              active={isHubActive(pathname, navigationHubs.find((hub) => hub.href === link.href) ?? { ...link, branches: [] })}
            />
          ))}
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={openMenu === "more"}
            aria-controls="student-more-navigation"
            onClick={() => setOpenMenu((current) => current === "more" ? null : "more")}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[0.68rem] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 ${moreRouteActive || openMenu === "more" ? "bg-cyan-200/12 text-cyan-100" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            <NavigationIcon href="more" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {openMenu === "more" ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close more navigation" className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => closeMenu()} />
          <section
            ref={moreDialogRef}
            id="student-more-navigation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-more-title"
            onKeyDown={trapDialogFocus}
            className="absolute inset-x-3 bottom-20 max-h-[min(70vh,36rem)] overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="student-more-title" className="text-lg font-black text-white">More</h2>
              <button type="button" onClick={() => closeMenu()} aria-label="Close more navigation" className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-xl text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80">×</button>
            </div>
            <div className="space-y-4">
              {moreGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{group.title}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.links.map((link) => {
                      const active = isRouteWithin(pathname, link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => closeMenu({ restoreFocus: false })}
                          className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 ${active ? "border-cyan-200/35 bg-cyan-200/12 text-cyan-100" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}
                        >
                          {link.icon ? <span aria-hidden="true">{link.icon}</span> : null}
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
