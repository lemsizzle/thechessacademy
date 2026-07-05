export class LichessRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message = "Lichess rate limit reached. Try again later.", retryAfterSeconds = 60) {
    super(message);
    this.name = "LichessRateLimitError";
    this.retryAfterSeconds = Math.max(60, retryAfterSeconds);
  }
}

export function getRetryAfterSeconds(headers: Headers) {
  const retryAfter = headers.get("retry-after");
  if (!retryAfter) return 60;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.max(60, Math.ceil(seconds));
  const date = new Date(retryAfter).getTime();
  if (!Number.isNaN(date)) return Math.max(60, Math.ceil((date - Date.now()) / 1000));
  return 60;
}

export function isLichessRateLimitError(error: unknown): error is LichessRateLimitError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return error instanceof LichessRateLimitError
    || message.includes("rate limit")
    || message.includes("rate-limit")
    || message.includes("rate-limiting")
    || message.includes("too many requests");
}

export function sanitizeLichessErrorDetail(detail: string) {
  return detail.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

export function formatCooldown(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "about 1 minute" : `about ${minutes} minutes`;
}
