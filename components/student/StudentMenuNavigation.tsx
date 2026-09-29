"use client";

import Link from "next/link";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";

type MenuContext = {
  revision: number;
  register: (href: string, open: () => void) => () => void;
  select: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
};
const Context = createContext<MenuContext | null>(null);

export function StudentMenuNavigation({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const destinations = useRef(new Map<string, () => void>());
  const register = useCallback((href: string, open: () => void) => {
    destinations.current.set(href, open);
    return () => { if (destinations.current.get(href) === open) destinations.current.delete(href); };
  }, []);
  const select = useCallback((event: MouseEvent<HTMLAnchorElement>, href: string) => {
    // Preserve new-tab, download, and normal cross-page navigation behavior.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || (event.currentTarget.target && event.currentTarget.target !== "_self") || event.currentTarget.hasAttribute("download")) return;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return;
    const open = destinations.current.get(target.pathname);
    if (open && !target.search && !target.hash) {
      event.preventDefault();
      open();
    } else if (target.search === window.location.search && !target.hash) {
      // Next preserves client state on same-URL links. A deliberate menu click
      // should return to the page's initial view, without reloading the shell.
      event.preventDefault();
      setRevision(current => current + 1);
    }
  }, []);
  const value = useMemo(() => ({ revision, register, select }), [revision, register, select]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function StudentMenuPage({ children }: { children: ReactNode }) {
  const menu = useContext(Context);
  return <Fragment key={menu?.revision ?? 0}>{children}</Fragment>;
}

export function useStudentMenuDestination(href: string, open: () => void) {
  const menu = useContext(Context);
  const latest = useRef(open);
  useEffect(() => { latest.current = open; }, [open]);
  const register = menu?.register;
  useEffect(() => register?.(href, () => latest.current()), [href, register]);
}

export function StudentMenuLink({ href, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const menu = useContext(Context);
  return <Link {...props} href={href} onClick={event => { onClick?.(event); menu?.select(event, href); }} />;
}
