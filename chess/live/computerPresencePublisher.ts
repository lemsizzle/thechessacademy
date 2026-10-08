import { COMPUTER_PRESENCE_THROTTLE_MS, type ComputerPresenceInput } from "./computerPresence";

type Snapshot = Omit<ComputerPresenceInput, "version">;
type Send = (input: ComputerPresenceInput, keepalive: boolean) => Promise<unknown>;

// Coalesce bursts (including premoves) and never make gameplay wait for the network.
export function createComputerPresencePublisher(snapshot: () => Snapshot, send: Send) {
  let version = 0;
  let pending = false;
  let inFlight = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSent = -Infinity;

  const flush = () => {
    timer = null;
    if (disposed || inFlight || !pending) return;
    pending = false;
    inFlight = true;
    lastSent = Date.now();
    void send({ ...snapshot(), version: ++version }, false).catch(() => {
      // The next heartbeat or move retries; there is no blocking error on the board.
    }).finally(() => {
      inFlight = false;
      if (pending && !disposed) schedule();
    });
  };

  const schedule = () => {
    if (disposed) return;
    pending = true;
    if (inFlight || timer !== null) return;
    const delay = Math.max(0, lastSent + COMPUTER_PRESENCE_THROTTLE_MS - Date.now());
    if (delay === 0) flush();
    else timer = setTimeout(flush, delay);
  };

  return {
    schedule,
    close() {
      if (disposed) return;
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      const latest = snapshot();
      void send({ ...latest, status: latest.status === "completed" ? "completed" : "closed", version: ++version }, true).catch(() => {});
    }
  };
}
