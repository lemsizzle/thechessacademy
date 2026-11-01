"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { AcademyChessboard } from "@/chess/components/AcademyChessboard";
import { ResponsiveChessboard } from "@/chess/components/ResponsiveChessboard";
import { useBoardAppearance } from "@/chess/appearance/BoardAppearanceProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  attemptStarWarsMove,
  type StarWarsMove,
  type StarWarsState,
} from "@/lib/puzzle-training/starWars";
import {
  BATTLE_LABELS,
  BATTLE_MODES,
  BATTLE_TIMES,
  type BattleAction,
  type BattleLobbyItem,
  type BattleMode,
  type BattleView,
  type PublicChallenge,
} from "@/lib/puzzle-battle/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import styles from "./PuzzleBattle.module.css";

const RULES: Record<BattleMode, string> = {
  survival: "Find the best moves. A wrong legal move or skip costs one life.",
  "star-wars":
    "Collect a star on every move. Clear the whole route for one point. A missed star, stranded route, or skip costs one life.",
  "hide-and-seek":
    "Mark every empty square that the black pieces do not attack, then press Check board. A wrong or incomplete board costs one life.",
};
const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
async function api(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error ?? "Couldn't connect. Please retry."),
      { status: response.status },
    );
  return data;
}
export function PuzzleBattle() {
  const [id, setId] = useState<string | null>(null),
    [battle, setBattle] = useState<BattleView | null>(null),
    [lobby, setLobby] = useState<BattleLobbyItem[]>([]);
  const [mode, setMode] = useState<BattleMode>("survival"),
    [duration, setDuration] = useState<number>(180),
    [code, setCode] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState<BattleAction | null>(null),
    [confirmLeave, setConfirmLeave] = useState(false);
  const [notice, setNotice] = useState(""),
    [now, setNow] = useState(Date.now());
  const current = useRef<BattleView | null>(null),
    clockAnchor = useRef({ server: Date.now(), local: 0 }),
    mutating = useRef(false),
    reading = useRef(false);
  const currentId = useRef<string | null>(null),
    lastBoard = useRef<PublicChallenge | null>(null);
  const retryRef = useRef<BattleAction | null>(null);
  const install = useCallback((next: BattleView) => {
    if (
      next.id !== currentId.current ||
      (current.current?.id === next.id &&
        current.current.version > next.version)
    )
      return;
    clockAnchor.current = { server: next.serverNow, local: performance.now() };
    current.current = next;
    setBattle(next);
    setNow(next.serverNow);
    if (
      retryRef.current &&
      next.state.players.find((p) => p.id === next.me)?.lastAction ===
        retryRef.current.actionId
    ) {
      retryRef.current = null;
      setRetry(null);
      setError("");
    }
    if (next.challenge) lastBoard.current = next.challenge;
  }, []);
  const open = useCallback((nextId: string | null) => {
    currentId.current = nextId;
    current.current = null;
    lastBoard.current = null;
    retryRef.current = null;
    setBattle(null);
    setId(nextId);
    setError("");
    setRetry(null);
    setConfirmLeave(false);
    history.replaceState(
      null,
      "",
      nextId ? `?id=${encodeURIComponent(nextId)}` : location.pathname,
    );
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const initial = query.get("id");
    if (initial) {
      currentId.current = initial;
      setId(initial);
    }
    setCode(query.get("code") ?? "");
  }, []);
  const refresh = useCallback(async () => {
    if (reading.current || document.hidden) return;
    reading.current = true;
    const wanted = currentId.current;
    try {
      const data = await api(
        wanted
          ? `/api/student/puzzle-battles/${wanted}`
          : "/api/student/puzzle-battles",
      );
      if (wanted !== currentId.current) return;
      if (wanted) install(data.battle);
      else setLobby(data.battles);
      if (!mutating.current && !retryRef.current) setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection lost. Retry when you're online.",
      );
    } finally {
      reading.current = false;
    }
  }, [install]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(
      () => {
        if (
          !current.current ||
          ["waiting", "playing"].includes(current.current.state.status)
        )
          void refresh();
      },
      id ? 10000 : 15000,
    );
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id, refresh]);
  useEffect(() => {
    if (battle?.state.status !== "playing") return;
    const timer = setInterval(
      () =>
        setNow(
          clockAnchor.current.server +
            performance.now() -
            clockAnchor.current.local,
        ),
      250,
    );
    return () => clearInterval(timer);
  }, [battle?.state.status]);
  const topic = battle && ["waiting", "playing"].includes(battle.state.status) ? battle.topic : undefined;
  useEffect(() => {
    if (!topic) return;
    const db = getSupabaseClient();
    if (!db) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = db
      .channel(topic)
      .on("broadcast", { event: "battle_changed" }, () => {
        if (!timer)
          timer = setTimeout(() => {
            timer = undefined;
            void refresh();
          }, 200);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, [topic, refresh]);
  const startsAt = battle?.state.startsAt,
    endsAt = battle?.state.endsAt;
  useEffect(() => {
    if (battle?.state.status !== "playing") return;
    const currentTime =
      clockAnchor.current.server +
      performance.now() -
      clockAnchor.current.local;
    const timers = [startsAt!, endsAt!]
      .filter((boundary) => boundary >= currentTime)
      .map((boundary) =>
        setTimeout(() => void refresh(), boundary - currentTime + 100),
      );
    return () => timers.forEach(clearTimeout);
    // Schedule at a boundary, not every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsAt, endsAt, battle?.state.status, refresh]);
  async function enter(joinCode?: string) {
    if (mutating.current) return;
    mutating.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await api(
        "/api/student/puzzle-battles",
        joinCode ? { action: "join", code: joinCode } : { mode, duration },
      );
      open(data.battle.id);
      install(data.battle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open this battle.");
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }
  const act = useCallback(
    async (input: Omit<BattleAction, "actionId">, saved?: BattleAction) => {
      if (mutating.current || !current.current) return;
      const view = current.current,
        me = view.state.players.find((p) => p.id === view.me)!;
      const action = saved ?? {
        ...input,
        revision: me.revision,
        actionId: crypto.randomUUID(),
      };
      mutating.current = true;
      setBusy(true);
      setError("");
      try {
        const { battle: next } = await api(
          `/api/student/puzzle-battles/${view.id}`,
          action,
        );
        install(next);
        retryRef.current = null;
        setRetry(null);
        setConfirmLeave(false);
        const after = (next as BattleView).state.players.find(
          (p) => p.id === view.me,
        )!;
        setNotice(
          after.score > me.score
            ? "Solved! +1 point"
            : after.mistakes > me.mistakes
              ? "Keep going — try the next board."
              : "",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Your move couldn't save.");
        const status = (e as { status?: number })?.status;
        retryRef.current = status && status < 500 ? null : action;
        setRetry(retryRef.current);
      } finally {
        mutating.current = false;
        setBusy(false);
      }
    },
    [install],
  );
  const errorPanel = error ? (
    <div
      role="alert"
      className="rounded-lg border border-amber-300/40 bg-amber-200/10 p-3 text-sm text-amber-100"
    >
      {error}
      <Button
        variant="secondary"
        className="ml-3"
        disabled={busy}
        onClick={() => (retry ? void act(retry, retry) : void refresh())}
      >
        Retry
      </Button>
    </div>
  ) : null;
  if (!id)
    return (
      <div className="space-y-5">
        <h1 className="text-3xl font-black">Puzzle Battle</h1>
        {errorPanel}
        <Card className="border-cyan-200/25 p-4 sm:p-6">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-200">
            Challenge a classmate
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Race through the same boards
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Three lives each. One point per completed board. Highest score wins;
            equal scores draw. Both players press Ready before the countdown.
          </p>
          <fieldset className="mt-5">
            <legend className="font-bold">Battle mode</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {BATTLE_MODES.map((value) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={`rounded-xl border p-4 text-left ${mode === value ? "border-cyan-200 bg-cyan-200/10" : "border-white/15 bg-white/5"}`}
                >
                  <strong>{BATTLE_LABELS[value]}</strong>
                  <span className="mt-2 block text-xs text-slate-300">
                    {RULES[value]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="font-bold">Time control</legend>
            <div className="mt-2 flex gap-2">
              {BATTLE_TIMES.map((value) => (
                <Button
                  key={value}
                  variant={duration === value ? "primary" : "secondary"}
                  aria-pressed={duration === value}
                  onClick={() => setDuration(value)}
                >
                  {value / 60} min
                </Button>
              ))}
            </div>
          </fieldset>
          <Button className="mt-5" disabled={busy} onClick={() => void enter()}>
            {busy ? "Preparing boards…" : "Create challenge"}
          </Button>
          <p className="mt-3 text-xs text-slate-400">
            Up to 50 boards. No hints or takebacks. Battle scores are separate
            from solo records and rewards.
          </p>
        </Card>
        <Card className="p-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void enter(code);
            }}
          >
            <label className="grow text-sm font-bold">
              Join with a code
              <input
                value={code}
                maxLength={8}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="8-character code"
                className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-3 font-mono uppercase"
                autoComplete="off"
              />
            </label>
            <Button disabled={busy || code.trim().length !== 8}>
              Join battle
            </Button>
          </form>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">
              Open challenges & your recent battles
            </h2>
            <Button variant="ghost" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
          {!lobby.length ? (
            <p className="mt-3 text-sm text-slate-400">
              No challenges yet. Create one and share its code with a classmate.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-white/10">
              {lobby.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <strong>
                      {item.host}
                      {item.opponent ? ` vs ${item.opponent}` : item.status === "waiting" ? " is waiting" : ""}
                    </strong>
                    <p className="text-sm text-slate-400">
                      {BATTLE_LABELS[item.mode]} · {item.duration / 60} min ·{" "}
                      {item.status === "finished"
                        ? `${item.scores.join(" – ")} · Finished`
                        : item.status === "cancelled"
                          ? "Closed"
                          : item.status === "playing"
                            ? "In progress"
                            : "Waiting"}
                    </p>
                  </div>
                  {item.mine ? (
                    <Button variant="secondary" onClick={() => open(item.id)}>
                      {["finished", "cancelled"].includes(item.status)
                        ? "View result"
                        : "Open battle"}
                    </Button>
                  ) : item.status === "waiting" ? (
                    <Button
                      disabled={busy}
                      onClick={() => void enter(item.code)}
                    >
                      Join
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  if (!battle)
    return (
      <Card className="space-y-4 p-5">
        <p role="status">Loading battle…</p>
        {errorPanel}
        <Button variant="secondary" onClick={() => open(null)}>
          Back to lobby
        </Button>
      </Card>
    );
  const state = battle.state,
    me = state.players.find((p) => p.id === battle.me)!,
    opponent = state.players.find((p) => p.id !== battle.me),
    finished = ["finished", "cancelled"].includes(state.status);
  const active =
    state.status === "playing" &&
    now >= state.startsAt! &&
    now < state.endsAt! &&
    !me.done;
  const board = battle.challenge ?? lastBoard.current;
  return (
    <div className={`${styles.battle} space-y-3`}>
      {errorPanel}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">
          {BATTLE_LABELS[battle.mode]} Battle · {battle.duration / 60} min
        </h2>
        <Button variant="ghost" onClick={() => open(null)}>
          Battle lobby
        </Button>
      </div>
      {state.status === "waiting" ? (
        <Card className="space-y-4 p-5">
          <h3 className="text-xl font-black">
            {opponent ? "Both players are here!" : "Waiting for a classmate"}
          </h3>
          <p>
            Challenge code:{" "}
            <strong className="font-mono text-2xl tracking-widest text-amber-200">
              {battle.code}
            </strong>
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${location.origin}/student/training/battle?code=${battle.code}`,
                );
                setNotice("Challenge link copied!");
              } catch {
                setNotice(`Share the code ${battle.code} with your classmate.`);
              }
            }}
          >
            Copy challenge link
          </Button>
          <p className="text-sm text-slate-300">
            {RULES[battle.mode]} Each player has three lives. This challenge
            closes after 10 minutes if it hasn't started.
          </p>
          {state.players.map((p) => (
            <p key={p.id}>
              <strong>{p.name}</strong> · {p.ready ? "Ready ✓" : "Not ready"}
            </p>
          ))}
          <Button
            disabled={busy || !opponent || me.ready}
            onClick={() => void act({ type: "ready" })}
          >
            {me.ready ? "Waiting for opponent…" : "I'm ready"}
          </Button>
          <p role="status" className="text-cyan-200">
            {notice}
          </p>
        </Card>
      ) : (
        <div className={styles.workspace}>
          <div className={`${styles.boardColumn} space-y-2`} data-board-column>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-cyan-200/25 bg-slate-950 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-cyan-200">
                  You · {me.name}
                </p>
                <strong className="text-2xl" data-testid="my-score">
                  {me.score}
                </strong>
                <span
                  className="ml-2 text-xs text-rose-200"
                  aria-label={`${3 - me.mistakes} lives`}
                >
                  {"♥".repeat(Math.max(0, 3 - me.mistakes)) || "Out of lives"}
                </span>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase text-slate-400">
                  {now < state.startsAt! ? "Starts in" : "Time left"}
                </p>
                <strong
                  className={`font-mono text-2xl tabular-nums ${state.endsAt! - now < 20000 ? "text-amber-200" : "text-white"}`}
                  data-testid="battle-clock"
                >
                  {finished
                    ? "Finished"
                    : clock(
                        now < state.startsAt!
                          ? state.startsAt! - now
                          : state.endsAt! - now,
                      )}
                </strong>
              </div>
              <div className="min-w-0 text-right">
                <p className="truncate text-xs text-violet-200">
                  {opponent?.name ?? "Opponent"}
                </p>
                <strong className="text-2xl" data-testid="opponent-score">
                  {opponent?.score ?? 0}
                </strong>
                <span className="ml-2 text-xs text-rose-200">
                  {"♥".repeat(Math.max(0, 3 - (opponent?.mistakes ?? 0)))}
                </span>
              </div>
            </div>
            {board ? (
              <BattleBoard
                key={`${battle.id}:${board.index}`}
                challenge={board}
                interactive={active && !busy && !retry}
                submit={act}
              />
            ) : (
              <div
                data-chess-board
                className="grid aspect-square place-items-center rounded-xl border border-cyan-200/25 bg-slate-950 p-8 text-center"
              >
                <div>
                  <p className="text-4xl">⚔</p>
                  <p className="mt-4 text-2xl font-black">
                    {finished
                      ? "Battle complete"
                      : now < state.startsAt!
                        ? "Get ready!"
                        : "Loading your board…"}
                  </p>
                  {!finished && (
                    <p className="mt-2">
                      The boards appear together when the countdown ends.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <Card className="space-y-4 self-start p-4">
            {finished ? (
              <>
                <p className="text-xs font-black uppercase text-cyan-200">
                  Battle result
                </p>
                <h3 className="text-2xl font-black">
                  {state.status === "cancelled"
                    ? "Challenge closed"
                    : state.winnerId === me.id
                      ? "You won! Nicely solved!"
                      : state.winnerId
                        ? "Good effort — keep practicing!"
                        : "A draw! Well played, both of you."}
                </h3>
                <p>
                  {me.score} – {opponent?.score ?? 0}
                </p>
                {state.players.some((p) => p.forfeited) && (
                  <p className="text-sm text-slate-300">
                    A player left the battle.
                  </p>
                )}
                <Button
                  onClick={() => {
                    setMode(battle.mode);
                    setDuration(battle.duration);
                    open(null);
                  }}
                >
                  New challenge
                </Button>
              </>
            ) : (
              <>
                <h3 className="font-black">
                  {me.done
                    ? "Your run is complete"
                    : `Board ${me.index + 1} of ${battle.totalChallenges}`}
                </h3>
                <p className="text-sm text-slate-300">
                  {me.done
                    ? "Watch your opponent's score until their run or the clock ends."
                    : RULES[battle.mode]}
                </p>
                <p role="status" className="min-h-6 font-bold text-cyan-200">
                  {busy ? "Checking…" : notice}
                </p>
                <Button
                  variant="secondary"
                  disabled={!active || busy || Boolean(retry)}
                  onClick={() => void act({ type: "skip" })}
                >
                  Skip · lose one life
                </Button>
                <p className="text-xs text-slate-400">
                  No hints or takebacks. Each completed board is one point.
                  Equal scores draw.
                </p>
              </>
            )}
          </Card>
        </div>
      )}
      {!finished && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmLeave(!confirmLeave)}
          >
            {state.status === "waiting" ? "Cancel challenge" : "Leave battle"}
          </Button>
          {confirmLeave && (
            <>
              <span className="text-sm text-amber-100">
                {state.status === "waiting"
                  ? "Close this challenge for both players?"
                  : "Leaving gives your opponent the win. Leave?"}
              </span>
              <Button
                disabled={busy}
                onClick={() => void act({ type: "leave" })}
              >
                Confirm leave
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmLeave(false)}
              >
                Keep playing
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const BattleBoard = memo(function BattleBoard({
  challenge,
  interactive,
  submit,
}: {
  challenge: PublicChallenge;
  interactive: boolean;
  submit: (action: Omit<BattleAction, "actionId">) => Promise<void>;
}) {
  const [star, setStar] = useState<StarWarsState>({
    fen: challenge.fen,
    remainingStars: (challenge.stars ?? []) as Square[],
    movableSquares: (challenge.movableSquares ?? []) as Square[],
  });
  const route = useRef<StarWarsMove[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [promotion, setPromotion] = useState<{ from: string; to: string } | null>(
      null,
    );
  const [starSelection, setStarSelection] = useState<string | null>(null);
  const { pieces, squareStyles } = useBoardAppearance();
  function move(from: string, to: string) {
    if (!interactive) return;
    if (challenge.kind === "survival") {
      const chess = new Chess(challenge.fen),
        promotes = chess
          .moves({ verbose: true, square: from as Square })
          .some((m) => m.to === to && m.promotion);
      if (promotes) {
        setPromotion({ from, to });
        return;
      }
      void submit({ type: "move", move: { from, to } });
      return;
    }
    const result = attemptStarWarsMove(star, {
      from: from as Square,
      to: to as Square,
    });
    if (result.status === "illegal") return;
    setStarSelection(null);
    route.current.push({ from: from as Square, to: to as Square });
    setStar(result.state);
    if (result.status === "solved" || result.status === "failed")
      void submit({ type: "finish", moves: [...route.current] });
  }
  if (challenge.kind === "hide-and-seek") {
    const placements: Record<string, string> = {};
    challenge.fen
      .split(" ")[0]
      .split("/")
      .forEach((row, r) => {
        let f = 0;
        for (const token of row) {
          if (/\d/.test(token)) f += Number(token);
          else {
            placements[`${String.fromCharCode(97 + f)}${8 - r}`] =
              `b${token.toUpperCase()}`;
            f++;
          }
        }
      });
    return (
      <div className="space-y-2">
        <div
          data-chess-board
          className="grid aspect-square grid-cols-8 overflow-hidden rounded-lg"
          aria-label="Find safe squares"
        >
          {Array.from({ length: 64 }, (_, i) => {
            const square = `${String.fromCharCode(97 + (i % 8))}${8 - Math.floor(i / 8)}`,
              piece = placements[square],
              Piece = piece ? pieces[piece] : null,
              marked = selected.includes(square);
            return (
              <button
                key={square}
                type="button"
                data-square={square}
                aria-label={`${square}${piece ? ` ${piece}` : ""}`}
                aria-pressed={marked}
                disabled={!interactive || Boolean(piece)}
                onClick={() =>
                  setSelected((s) =>
                    s.includes(square)
                      ? s.filter((v) => v !== square)
                      : [...s, square],
                  )
                }
                className="relative flex aspect-square min-w-0 items-center justify-center p-1 text-3xl text-amber-400 focus-visible:z-10 focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-400"
                style={
                  (Math.floor(i / 8) + (i % 8)) % 2
                    ? squareStyles.darkSquareStyle
                    : squareStyles.lightSquareStyle
                }
              >
                {Piece ? <Piece /> : marked ? "★" : null}
                <span className="absolute bottom-0 right-1 text-[9px] text-slate-700">
                  {square}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            {selected.length} / {challenge.totalSafe} stars marked
          </span>
          <Button
            disabled={!interactive || !selected.length}
            onClick={() => void submit({ type: "finish", squares: selected })}
          >
            Check board
          </Button>
        </div>
      </div>
    );
  }
  if (challenge.kind === "star-wars")
    return (
      <div className="relative">
        <ResponsiveChessboard
          options={{
            id: "puzzle-battle-stars",
            position: star.fen,
            boardOrientation: "white",
            pieces,
            ...squareStyles,
            allowDrawingArrows: true,
            clearArrowsOnClick: true,
            allowDragging: interactive,
            canDragPiece: ({ square }) =>
              interactive && star.movableSquares.includes(square as Square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!interactive || !targetSquare) return false;
              move(sourceSquare, targetSquare);
              return false;
            },
            onSquareClick: ({ square }) => {
              if (!interactive) return;
              if (star.movableSquares.includes(square as Square)) {
                setStarSelection(square === starSelection ? null : square);
                return;
              }
              if (starSelection) move(starSelection, square);
            },
            squareStyles: starSelection
              ? { [starSelection]: { boxShadow: "inset 0 0 0 4px #fbbf24" } }
              : {},
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-8"
        >
          {Array.from({ length: 64 }, (_, i) => {
            const square = `${String.fromCharCode(97 + (i % 8))}${8 - Math.floor(i / 8)}`;
            return (
              <span
                key={square}
                className="flex items-center justify-center text-3xl text-amber-300 drop-shadow-[0_1px_2px_#000]"
              >
                {star.remainingStars.includes(square as Square) ? "★" : ""}
              </span>
            );
          })}
        </div>
      </div>
    );
  const fen = challenge.fen;
  return (
    <div className="space-y-2">
      <div className="relative">
        <AcademyChessboard
          boardId="puzzle-battle-board"
          fen={fen}
          orientation={challenge.orientation}
          humanColor={challenge.orientation}
          interactive={interactive && !promotion}
          lastMove={null}
          onMove={move}
          allowDrawingArrows
        />
      </div>
      {promotion && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-950 p-2"
          role="group"
          aria-label="Choose promotion"
        >
          <span>Promote to:</span>
          {(
            [
              ["q", "Queen"],
              ["r", "Rook"],
              ["b", "Bishop"],
              ["n", "Knight"],
            ] as const
          ).map(([piece, label]) => (
            <Button
              key={piece}
              disabled={!interactive}
              onClick={() => {
                const move = { ...promotion, promotion: piece };
                setPromotion(null);
                void submit({ type: "move", move });
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});
