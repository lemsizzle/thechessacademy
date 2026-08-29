"use client";

import { Button } from "@/components/Button";
import {
  EMPTY_CORRESPONDENCE_INBOX,
  formatCorrespondenceTimeLeft,
  readCorrespondenceInbox,
  type CorrespondenceChallenge,
  type CorrespondenceGameSummary,
  type CorrespondenceInbox
} from "@/lib/correspondence/clientTypes";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";

type ChallengeAction = "accept" | "reject" | "cancel";
type Relationship =
  | { kind: "incoming"; challenge: CorrespondenceChallenge }
  | { kind: "outgoing"; challenge: CorrespondenceChallenge }
  | { kind: "game"; game: CorrespondenceGameSummary }
  | { kind: "none" };

type CorrespondenceContextValue = {
  inbox: CorrespondenceInbox;
  loading: boolean;
  error: string;
  pendingKey: string | null;
  refresh: () => Promise<void>;
  sendChallenge: (recipientStudentId: string, recipientName?: string) => Promise<boolean>;
  actOnChallenge: (challengeId: string, action: ChallengeAction) => Promise<string | null>;
  relationshipFor: (studentId: string) => Relationship;
  openInbox: () => void;
};

const CorrespondenceContext = createContext<CorrespondenceContextValue | null>(null);
const POLL_INTERVAL_MS = 30_000;

function responseError(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") return value.error;
  return fallback;
}

function challengeGameId(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.gameId === "string") return body.gameId;
  if (body.game && typeof body.game === "object" && typeof (body.game as Record<string, unknown>).id === "string") {
    return (body.game as Record<string, unknown>).id as string;
  }
  if (body.challenge && typeof body.challenge === "object") {
    const acceptedGameId = (body.challenge as Record<string, unknown>).acceptedGameId;
    return typeof acceptedGameId === "string" ? acceptedGameId : null;
  }
  return null;
}

function InboxChallengeCard({
  challenge,
  direction,
  pendingKey,
  onAction
}: {
  challenge: CorrespondenceChallenge;
  direction: "incoming" | "outgoing";
  pendingKey: string | null;
  onAction: (challengeId: string, action: ChallengeAction) => void;
}) {
  const other = direction === "incoming" ? challenge.challenger : challenge.recipient;
  const pending = pendingKey?.startsWith(`${challenge.id}:`) ?? false;
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-white">{other.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            {direction === "incoming" ? "Wants to play a correspondence game" : "Waiting for a response"}
          </p>
        </div>
        <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2 py-1 text-[10px] font-black uppercase text-amber-100">
          {challenge.status}
        </span>
      </div>
      {challenge.status === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {direction === "incoming" ? (
            <>
              <Button type="button" className="flex-1" disabled={pending} onClick={() => onAction(challenge.id, "accept")}>Accept</Button>
              <Button type="button" variant="ghost" className="flex-1" disabled={pending} onClick={() => onAction(challenge.id, "reject")}>Reject</Button>
            </>
          ) : (
            <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => onAction(challenge.id, "cancel")}>Cancel challenge</Button>
          )}
        </div>
      ) : challenge.acceptedGameId ? (
        <Button href={`/student/play/correspondence/${challenge.acceptedGameId}`} variant="secondary" className="mt-3 w-full">Open game</Button>
      ) : null}
    </article>
  );
}

function InboxGameCard({ game, onOpen }: { game: CorrespondenceGameSummary; onOpen: () => void }) {
  const yourMove = game.activeColor === game.viewerColor;
  return (
    <Link
      href={`/student/play/correspondence/${game.id}`}
      onClick={onOpen}
      className={`block rounded-lg border p-3 transition ${yourMove ? "border-amber-200/35 bg-amber-200/10 hover:bg-amber-200/15" : "border-white/10 bg-white/[0.05] hover:bg-white/10"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black text-white">{game.opponent?.name ?? "Academy student"}</p>
          <p className={`mt-1 text-xs font-bold ${yourMove ? "text-amber-100" : "text-slate-400"}`}>{yourMove ? "Your move" : "Waiting for opponent"}</p>
        </div>
        <span className="shrink-0 text-xs font-bold text-cyan-100">{formatCorrespondenceTimeLeft(game.turnDeadlineAt)}</span>
      </div>
    </Link>
  );
}

function InboxDialog({
  inbox,
  loading,
  pendingKey,
  error,
  onClose,
  onRefresh,
  onAction
}: {
  inbox: CorrespondenceInbox;
  loading: boolean;
  pendingKey: string | null;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
  onAction: (challengeId: string, action: ChallengeAction) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const pendingIncoming = inbox.incoming.filter((challenge) => challenge.status === "pending");
  const pendingOutgoing = inbox.outgoing.filter((challenge) => challenge.status === "pending");

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="correspondence-inbox-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl border border-cyan-200/20 bg-slate-950 shadow-[0_-20px_70px_rgba(0,0,0,.55)] md:inset-y-0 md:left-auto md:w-[430px] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Play over a few days</p>
            <h2 id="correspondence-inbox-title" className="mt-1 text-2xl font-black text-white">Correspondence</h2>
            <p className="mt-1 text-xs text-slate-400">You have three days to make each move.</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close correspondence inbox" onClick={onClose} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-black text-slate-200 hover:bg-white/10">✕</button>
        </header>

        <div className="scrollbar-soft flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {error ? <p className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-bold text-rose-100" role="alert">{error}</p> : null}
          {loading ? <p className="text-sm text-slate-400">Loading your challenges...</p> : null}

          <section aria-labelledby="incoming-challenges-title">
            <div className="flex items-center justify-between gap-2">
              <h3 id="incoming-challenges-title" className="font-black text-white">Incoming challenges</h3>
              <span className="text-xs font-bold text-slate-500">{pendingIncoming.length}</span>
            </div>
            <div className="mt-2 grid gap-2">
              {pendingIncoming.length ? pendingIncoming.map((challenge) => (
                <InboxChallengeCard key={challenge.id} challenge={challenge} direction="incoming" pendingKey={pendingKey} onAction={onAction} />
              )) : <p className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-slate-500">No one is waiting for your answer.</p>}
            </div>
          </section>

          <section aria-labelledby="correspondence-games-title">
            <div className="flex items-center justify-between gap-2">
              <h3 id="correspondence-games-title" className="font-black text-white">Active games</h3>
              <span className="text-xs font-bold text-slate-500">{inbox.activeGames.length} / 10</span>
            </div>
            <div className="mt-2 grid gap-2">
              {inbox.activeGames.length ? inbox.activeGames.map((game) => <InboxGameCard key={game.id} game={game} onOpen={onClose} />) : (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-slate-500">No correspondence games are active.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="sent-challenges-title">
            <div className="flex items-center justify-between gap-2">
              <h3 id="sent-challenges-title" className="font-black text-white">Sent challenges</h3>
              <span className="text-xs font-bold text-slate-500">{pendingOutgoing.length} / 5</span>
            </div>
            <div className="mt-2 grid gap-2">
              {pendingOutgoing.length ? pendingOutgoing.map((challenge) => (
                <InboxChallengeCard key={challenge.id} challenge={challenge} direction="outgoing" pendingKey={pendingKey} onAction={onAction} />
              )) : <p className="rounded-lg border border-dashed border-white/10 p-3 text-sm text-slate-500">You have not sent a challenge.</p>}
            </div>
          </section>
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-white/10 p-4">
          <Button href="/student/play/correspondence" variant="secondary" onClick={onClose}>Open hub</Button>
          <Button type="button" variant="ghost" onClick={onRefresh}>Refresh</Button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

export function CorrespondenceProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  const router = useRouter();
  const [inbox, setInbox] = useState<CorrespondenceInbox>(EMPTY_CORRESPONDENCE_INBOX);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const mounted = useRef(true);
  const requestPending = useRef(false);
  const refreshSequence = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const response = await fetch("/api/student/correspondence", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as unknown;
      if (!response.ok) throw new Error(responseError(body, "Correspondence challenges could not be loaded."));
      const next = readCorrespondenceInbox(body);
      if (!mounted.current || sequence !== refreshSequence.current) return;
      setInbox(next);
      setError("");

      const notificationKey = `correspondence-notified:${studentId}`;
      let notifiedIds: string[] = [];
      try {
        const stored = JSON.parse(window.sessionStorage.getItem(notificationKey) ?? "[]") as unknown;
        if (Array.isArray(stored)) notifiedIds = stored.filter((item): item is string => typeof item === "string");
      } catch {
        window.sessionStorage.removeItem(notificationKey);
      }
      const notified = new Set<string>(notifiedIds);
      const newChallenge = next.incoming.find((challenge) => challenge.status === "pending" && !challenge.seenAt && !notified.has(challenge.id));
      if (newChallenge) {
        notified.add(newChallenge.id);
        window.sessionStorage.setItem(notificationKey, JSON.stringify(Array.from(notified).slice(-30)));
        setToast(`${newChallenge.challenger.name} challenged you to a correspondence game.`);
      }
    } catch (caught) {
      if (mounted.current && sequence === refreshSequence.current) setError(caught instanceof Error ? caught.message : "Correspondence challenges could not be loaded.");
    } finally {
      if (mounted.current && sequence === refreshSequence.current) setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!inbox.realtimeTopic) return;
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(inbox.realtimeTopic)
      .on("broadcast", { event: "correspondence_changed" }, () => void refresh())
      .on("broadcast", { event: "challenge_changed" }, () => void refresh())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [inbox.realtimeTopic, refresh]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 7_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const markSeen = useCallback(async () => {
    setInbox((current) => ({ ...current, unreadCount: 0 }));
    await fetch("/api/student/correspondence/seen", { method: "POST" }).catch(() => undefined);
  }, []);

  const openInbox = useCallback(() => {
    setPanelOpen(true);
    setToast("");
    if (inbox.unreadCount > 0) void markSeen();
  }, [inbox.unreadCount, markSeen]);

  const closeInbox = useCallback(() => {
    setPanelOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const sendChallenge = useCallback(async (recipientStudentId: string, recipientName?: string) => {
    const key = `new:${recipientStudentId}`;
    if (requestPending.current) return false;
    requestPending.current = true;
    setPendingKey(key);
    setError("");
    try {
      const response = await fetch("/api/student/correspondence/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientStudentId })
      });
      const body = await response.json().catch(() => ({})) as unknown;
      if (!response.ok) throw new Error(responseError(body, "Challenge could not be sent."));
      setToast(`Challenge sent${recipientName ? ` to ${recipientName}` : ""}.`);
      await refresh();
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Challenge could not be sent.";
      setError(message);
      setToast(message);
      return false;
    } finally {
      requestPending.current = false;
      setPendingKey(null);
    }
  }, [refresh]);

  const actOnChallenge = useCallback(async (challengeId: string, action: ChallengeAction) => {
    const key = `${challengeId}:${action}`;
    if (requestPending.current) return null;
    requestPending.current = true;
    setPendingKey(key);
    setError("");
    try {
      const response = await fetch(`/api/student/correspondence/challenges/${encodeURIComponent(challengeId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await response.json().catch(() => ({})) as unknown;
      if (!response.ok) throw new Error(responseError(body, `Challenge could not be ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "cancelled"}.`));
      const gameId = challengeGameId(body);
      setToast(action === "accept" ? "Challenge accepted. Your game is ready!" : action === "reject" ? "Challenge rejected." : "Challenge cancelled.");
      await refresh();
      return gameId;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Challenge could not be updated.";
      setError(message);
      setToast(message);
      return null;
    } finally {
      requestPending.current = false;
      setPendingKey(null);
    }
  }, [refresh]);

  const relationshipFor = useCallback((otherStudentId: string): Relationship => {
    const game = inbox.activeGames.find((item) => item.opponent?.id === otherStudentId);
    if (game) return { kind: "game", game };
    const incoming = inbox.incoming.find((item) => item.status === "pending" && item.challenger.id === otherStudentId);
    if (incoming) return { kind: "incoming", challenge: incoming };
    const outgoing = inbox.outgoing.find((item) => item.status === "pending" && item.recipient.id === otherStudentId);
    if (outgoing) return { kind: "outgoing", challenge: outgoing };
    return { kind: "none" };
  }, [inbox.activeGames, inbox.incoming, inbox.outgoing]);

  const value = useMemo<CorrespondenceContextValue>(() => ({
    inbox,
    loading,
    error,
    pendingKey,
    refresh,
    sendChallenge,
    actOnChallenge,
    relationshipFor,
    openInbox
  }), [actOnChallenge, error, inbox, loading, openInbox, pendingKey, refresh, relationshipFor, sendChallenge]);

  function handleInboxAction(challengeId: string, action: ChallengeAction) {
    void actOnChallenge(challengeId, action).then((gameId) => {
      if (action === "accept" && gameId) {
        setPanelOpen(false);
        router.push(`/student/play/correspondence/${gameId}`);
      }
    });
  }

  return (
    <CorrespondenceContext.Provider value={value}>
      {children}
      <button
        ref={triggerRef}
        type="button"
        onClick={openInbox}
        aria-label={`Correspondence challenges${inbox.unreadCount ? `, ${inbox.unreadCount} unread` : ""}`}
        aria-haspopup="dialog"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-cyan-200/40 bg-slate-950/95 px-4 py-3 text-sm font-black text-white shadow-[0_10px_45px_rgba(34,211,238,.28)] transition hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
      >
        <span aria-hidden="true">♟</span>
        <span className="hidden sm:inline">Challenges</span>
        {inbox.unreadCount > 0 ? <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-400 px-1 text-[11px] text-slate-950">{Math.min(99, inbox.unreadCount)}</span> : null}
      </button>
      {panelOpen && typeof document !== "undefined" ? (
        <InboxDialog inbox={inbox} loading={loading} pendingKey={pendingKey} error={error} onClose={closeInbox} onRefresh={() => void refresh()} onAction={handleInboxAction} />
      ) : null}
      {toast && typeof document !== "undefined" ? createPortal(
        <div className="fixed right-4 top-20 z-[90] flex max-w-sm items-start gap-3 rounded-lg border border-cyan-200/30 bg-slate-950/95 p-4 text-sm font-bold text-cyan-50 shadow-[0_18px_55px_rgba(0,0,0,.55)]" role="status" aria-live="polite">
          <span className="text-lg" aria-hidden="true">♞</span>
          <span className="flex-1">{toast}</span>
          <button type="button" aria-label="Dismiss notification" className="text-slate-400 hover:text-white" onClick={() => setToast("")}>✕</button>
        </div>,
        document.body
      ) : null}
    </CorrespondenceContext.Provider>
  );
}

export function useCorrespondence() {
  const value = useContext(CorrespondenceContext);
  if (!value) throw new Error("useCorrespondence must be used inside StudentPortalShell.");
  return value;
}

export function useOptionalCorrespondence() {
  return useContext(CorrespondenceContext);
}
