"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Use the available width on portrait phones; fit the board column on wider screens. */
export function BoardViewport({ children, className = "space-y-2", maxWidth = 700, fitToScreen = false }: { children: ReactNode; className?: string; maxWidth?: number; fitToScreen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const column = ref.current;
    if (!column) return;
    let frame = 0;
    let focusFrame = 0;
    const fit = () => {
      if (fitToScreen) {
        const board = column.querySelector<HTMLElement>("[data-chess-board]");
        if (!board) return;
        const height = window.visualViewport?.height ?? window.innerHeight;
        const header = document.querySelector<HTMLElement>("header.sticky");
        const navigation = document.querySelector<HTMLElement>('nav[aria-label="Primary student navigation"]');
        const topSpace = header?.getBoundingClientRect().height ?? 0;
        const bottomSpace = navigation?.getBoundingClientRect().height ?? 0;
        column.style.scrollMarginTop = `${topSpace + 8}px`;
        board.style.scrollMarginTop = `${topSpace + 8}px`;
        // Page headings can scroll away. Reserve only visible navigation and the
        // clocks/panels; short landscape screens prioritize the board itself.
        const chrome = height < 600 && window.innerWidth > height
          ? 0 : Math.max(0, column.getBoundingClientRect().height - board.getBoundingClientRect().height);
        const size = Math.floor(Math.min(maxWidth, Math.max(0, height - topSpace - bottomSpace - chrome - 16)));
        const width = `min(100%, ${size}px)`;
        if (column.style.width !== width) column.style.width = width;
        return;
      }
      // Phone headers and player panels can consume most of the viewport height.
      // Keep squares easy to tap; vertical scrolling is preferable to a tiny board.
      if (window.matchMedia("(max-width: 767px) and (orientation: portrait)").matches) {
        if (column.style.width !== "100%") column.style.width = "100%";
        return;
      }
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
    const resize = () => {
      schedule();
      if (!fitToScreen) return;
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        fit();
        const height = window.visualViewport?.height ?? window.innerHeight;
        const target = height < 600 && window.innerWidth > height ? column.querySelector<HTMLElement>("[data-chess-board]") : column;
        target?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(column);
    if (column.parentElement) observer.observe(column.parentElement);
    const mutations = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.matches("[data-chess-board]") || node.querySelector("[data-chess-board]"))))) schedule();
    });
    mutations.observe(column, { childList: true, subtree: true });
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", schedule);
    fit();
    if (fitToScreen) resize();
    return () => { cancelAnimationFrame(focusFrame); cancelAnimationFrame(frame); observer.disconnect(); mutations.disconnect(); window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", schedule); };
  }, [maxWidth, fitToScreen]);
  return <div ref={ref} data-board-column className={`mx-auto w-full min-w-0 ${className}`} style={{ maxWidth }}>{children}</div>;
}
