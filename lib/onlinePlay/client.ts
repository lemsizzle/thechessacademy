import type { OnlinePlayState } from "./types";

export class OnlinePlayRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** A presence update also returns the list, avoiding a second authenticated request. */
export async function fetchOnlinePlayState(heartbeat = false, onHeartbeat?: () => void): Promise<OnlinePlayState> {
  if (heartbeat) {
    try {
      const response = await fetch("/api/student/online-play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", includeState: true }),
        cache: "no-store"
      });
      if (response.ok) {
        onHeartbeat?.();
        const body = await response.json();
        if (body.state) return body.state as OnlinePlayState;
      }
    } catch { /* Still load invitations if presence fails or an older server is deployed. */ }
  }

  const response = await fetch("/api/student/online-play", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new OnlinePlayRequestError(body.error || "Online play could not be loaded.", response.status);
  return body.state as OnlinePlayState;
}
