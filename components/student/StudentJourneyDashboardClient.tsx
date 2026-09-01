"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { Button } from "@/components/Button";
import { createCoalescedDashboardRefresh } from "@/lib/student/dashboardRefresh";
import { STUDENT_LICHESS_FULL_SYNC_EVENT } from "@/lib/studentLichessFullSync";

export type ProgressTab = "overview" | "training" | "achievements" | "activity";

type ProgressPanels = Record<ProgressTab, ReactNode>;

const progressTabs: ReadonlyArray<{ id: ProgressTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "training", label: "Training" },
  { id: "achievements", label: "Achievements" },
  { id: "activity", label: "Activity" }
];
const progressTabIds = new Set<ProgressTab>(progressTabs.map((tab) => tab.id));

function requestedProgressTab(requested: string | null): ProgressTab | null {
  if (!requested) return null;
  return progressTabIds.has(requested as ProgressTab) ? (requested as ProgressTab) : null;
}

const ProgressDialogContext = createContext<((tab: ProgressTab) => void) | null>(null);

function ProgressDialog({
  panels,
  hasUnavailableSections,
  initialTab,
  onClose
}: {
  panels: ProgressPanels;
  hasUnavailableSections: boolean;
  initialTab: ProgressTab;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ProgressTab>(initialTab);
  const dialogRef = useRef<HTMLElement>(null);
  const tabRefs = useRef(new Map<ProgressTab, HTMLButtonElement>());

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function handleFocusTrap(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeIndex = Array.from(focusable).indexOf(document.activeElement as HTMLElement);
    if (activeIndex === -1) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % progressTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + progressTabs.length) % progressTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = progressTabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = progressTabs[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current.get(nextTab)?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/90 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <section
          id="student-progress-dialog"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-progress-title"
          aria-describedby="student-progress-description"
          tabIndex={-1}
          onKeyDown={handleFocusTrap}
          className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border-white/10 bg-slate-950 shadow-[0_28px_110px_rgba(0,0,0,0.75)] outline-none sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-xl sm:border"
        >
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-cyan-300/10 via-slate-950 to-amber-300/10 px-4 py-4 sm:px-6 sm:py-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">My Academy Journey</p>
              <h2 id="student-progress-title" className="mt-1 text-2xl font-black text-white sm:text-3xl">Your progress</h2>
              <p id="student-progress-description" className="mt-1 text-sm text-slate-300">Training, achievements, ratings, and rewards in one place.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close progress window"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-2xl font-black text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              ×
            </button>
          </div>

          <div className="overflow-x-auto border-b border-white/10 bg-black/20 px-3 sm:px-5">
            <div role="tablist" aria-label="Progress sections" className="flex min-w-max gap-1">
              {progressTabs.map((tab, index) => (
                <button
                  key={tab.id}
                  ref={(node) => {
                    if (node) tabRefs.current.set(tab.id, node);
                    else tabRefs.current.delete(tab.id);
                  }}
                  id={`student-progress-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls="student-progress-panel"
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`border-b-2 px-4 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200 ${activeTab === tab.id ? "border-cyan-200 text-white" : "border-transparent text-slate-400 hover:text-slate-100"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {hasUnavailableSections ? (
              <p role="status" className="mb-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-50">
                Some progress details are temporarily unavailable. The rest of your journey is ready to use.
              </p>
            ) : null}
            <div
              id="student-progress-panel"
              role="tabpanel"
              aria-labelledby={`student-progress-tab-${activeTab}`}
              tabIndex={0}
              className="outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
            >
              {panels[activeTab]}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function StudentJourneyDashboardClient({
  children,
  panels,
  hasUnavailableSections
}: {
  children: ReactNode;
  panels: ProgressPanels;
  hasUnavailableSections: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progressTab, setProgressTab] = useState<ProgressTab | null>(null);
  const closeProgress = useCallback(() => {
    setProgressTab(null);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("progress")) return;
    url.searchParams.delete("progress");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const openProgress = useCallback((tab: ProgressTab) => setProgressTab(tab), []);

  useEffect(() => {
    const requested = requestedProgressTab(searchParams.get("progress"));
    if (requested) setProgressTab(requested);
  }, [searchParams]);

  useEffect(() => {
    const refresh = createCoalescedDashboardRefresh(() => router.refresh());

    function handleFullSync() {
      refresh.schedule();
    }

    window.addEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, handleFullSync);
    return () => {
      window.removeEventListener(STUDENT_LICHESS_FULL_SYNC_EVENT, handleFullSync);
      refresh.cancel();
    };
  }, [router]);

  return (
    <ProgressDialogContext.Provider value={openProgress}>
      {children}
      {progressTab ? (
        <ProgressDialog
          key={progressTab}
          panels={panels}
          hasUnavailableSections={hasUnavailableSections}
          initialTab={progressTab}
          onClose={closeProgress}
        />
      ) : null}
    </ProgressDialogContext.Provider>
  );
}

export function ProgressDialogTrigger({
  tab,
  children,
  className = "",
  variant = "primary"
}: {
  tab: ProgressTab;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const openProgress = useContext(ProgressDialogContext);
  if (!openProgress) throw new Error("ProgressDialogTrigger must be rendered inside StudentJourneyDashboardClient.");

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      aria-haspopup="dialog"
      aria-controls="student-progress-dialog"
      onClick={() => openProgress(tab)}
    >
      {children}
    </Button>
  );
}
