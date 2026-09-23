"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Fit the whole board column, including clocks/tools, without scaling its hit targets. */
export function BoardViewport({ children, className = "space-y-2", maxWidth = 700 }: { children: ReactNode; className?: string; maxWidth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const column = ref.current;
    if (!column) return;
    let frame = 0;
    const fit = () => {
      const board = column.querySelector<HTMLElement>("[data-chess-board]");
      if (!board) return;
      const rect = column.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      // Keep the mobile navigation and a small celebration area below the board.
      const bottomSpace = window.matchMedia("(max-width: 767px)").matches ? 144 : 80;
      const chrome = Math.max(0, rect.height - board.getBoundingClientRect().height);
      const top = Math.max(0, Math.min(rect.top + window.scrollY, viewportHeight * 0.45));
      const size = Math.floor(Math.min(maxWidth, Math.max(176, viewportHeight - top - chrome - bottomSpace)));
      const width = `min(100%, ${size}px)`;
      if (column.style.width !== width) column.style.width = width;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    const observer = new ResizeObserver(schedule);
    observer.observe(column);
    if (column.parentElement) observer.observe(column.parentElement);
    const mutations = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.matches("[data-chess-board]") || node.querySelector("[data-chess-board]"))))) schedule();
    });
    mutations.observe(column, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    fit();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); window.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("resize", schedule); };
  }, [maxWidth]);
  return <div ref={ref} data-board-column className={`mx-auto w-full min-w-0 ${className}`} style={{ maxWidth }}>{children}</div>;
}
