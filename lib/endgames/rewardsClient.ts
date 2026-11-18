export async function endgameRewardRequest<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/student/endgames", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Couldn't save practice rewards. Please retry.");
  return data as T;
}
