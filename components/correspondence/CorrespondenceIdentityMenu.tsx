"use client";

import { useOptionalCorrespondence } from "@/components/correspondence/CorrespondenceProvider";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

type MenuPosition = { mobile: boolean; style: CSSProperties };

function positionFor(element: HTMLElement): MenuPosition {
  const rect = element.getBoundingClientRect();
  if (window.innerWidth < 640) return { mobile: true, style: {} };
  const width = 288;
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  return { mobile: false, style: { left, top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 220)), width } };
}

export function CorrespondenceIdentityMenu({
  studentId,
  studentName,
  profileHref,
  viewerStudentId,
  enabled,
  className,
  children
}: {
  studentId: string;
  studentName: string;
  profileHref: string;
  viewerStudentId?: string;
  enabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const correspondence = useOptionalCorrespondence();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ mobile: false, style: {} });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const canChallenge = Boolean(enabled && correspondence && viewerStudentId && viewerStudentId !== studentId);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) setPosition(positionFor(triggerRef.current));
  }, []);

  const showMenu = useCallback(() => {
    if (!canChallenge || !triggerRef.current) return;
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    updatePosition();
    setOpen(true);
  }, [canChallenge, updatePosition]);

  const closeMenu = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  }, []);

  const closeIfFocusLeft = useCallback(() => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active && !triggerRef.current?.contains(active) && !menuRef.current?.contains(active)) setOpen(false);
    }, 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }
    function reposition() {
      updatePosition();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [closeMenu, open, updatePosition]);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  if (!canChallenge || !correspondence) {
    return <Link href={profileHref} className={className}>{children}</Link>;
  }

  const relationship = correspondence.relationshipFor(studentId);
  const pending = correspondence.pendingKey === `new:${studentId}`;

  async function handleMainAction() {
    if (relationship.kind === "none") {
      const sent = await correspondence!.sendChallenge(studentId, studentName);
      if (sent) closeMenu();
      return;
    }
    if (relationship.kind === "game") {
      closeMenu();
      window.location.assign(`/student/play/correspondence/${relationship.game.id}`);
      return;
    }
    closeMenu();
    correspondence!.openInbox();
  }

  const actionLabel = relationship.kind === "none"
    ? pending ? "Sending challenge..." : "Challenge to correspondence"
    : relationship.kind === "incoming"
      ? "Respond to challenge"
      : relationship.kind === "outgoing"
        ? "Challenge sent"
        : "Open correspondence game";

  const menu = (
    <>
      {position.mobile ? <button type="button" aria-label="Close student actions" className="fixed inset-0 z-[70] cursor-default bg-slate-950/65 backdrop-blur-sm" onClick={closeMenu} /> : null}
      <div
        ref={menuRef}
        role="menu"
        aria-label={`Actions for ${studentName}`}
        onPointerEnter={() => closeTimer.current !== null && window.clearTimeout(closeTimer.current)}
        onPointerLeave={scheduleClose}
        onBlur={closeIfFocusLeft}
        className={position.mobile
          ? "fixed inset-x-3 bottom-3 z-[71] rounded-xl border border-cyan-200/25 bg-slate-950 p-3 shadow-[0_20px_70px_rgba(0,0,0,.65)]"
          : "fixed z-[71] rounded-xl border border-cyan-200/25 bg-slate-950 p-3 shadow-[0_20px_70px_rgba(0,0,0,.65)]"}
        style={position.style}
      >
        <div className="border-b border-white/10 px-2 pb-3">
          <p className="truncate font-black text-white">{studentName}</p>
          <p className="mt-1 text-xs text-slate-400">Student actions</p>
        </div>
        <div className="mt-2 grid gap-1">
          <Link role="menuitem" href={profileHref} onClick={() => closeMenu()} className="rounded-md px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">
            View profile
          </Link>
          <button
            role="menuitem"
            type="button"
            disabled={pending}
            onClick={() => void handleMainAction()}
            className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2.5 text-left text-sm font-black text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open actions for ${studentName}`}
        className={className}
        onClick={showMenu}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") showMenu();
        }}
        onPointerLeave={scheduleClose}
        onFocus={showMenu}
        onBlur={closeIfFocusLeft}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && (event.key !== "Tab" || event.shiftKey || !open)) return;
          event.preventDefault();
          showMenu();
          window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
        }}
      >
        {children}
      </button>
      {open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </>
  );
}
