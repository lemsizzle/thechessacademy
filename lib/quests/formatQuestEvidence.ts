export function formatQuestEvidence(evidence: string) {
  if (!evidence) return evidence;
  const compact = evidence
    .replace(/<[^>]*>/g, " ")
    .replace(/https:\/\/http\.lichess\.org\/429/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/Lichess (game|puzzle) sync did not return fresh data/i.test(compact) && /429|rate-?limit|rate-limiting|Too many requests/i.test(compact)) {
    return "Lichess rate limit reached. Wait a few minutes, then sync again. Previous progress is kept when available.";
  }

  if (/No real puzzle token|requires the student's Lichess login token/i.test(compact)) {
    return "Puzzle quests update when the student syncs from their own logged-in Lichess account.";
  }

  return evidence
    .replace(/<[^>]*>/g, " ")
    .replace(/https:\/\/http\.lichess\.org\/429/g, "")
    .replace(/\s+/g, " ")
    .replace(/Lichess game activity failed with 429:[^.]*\./, "Lichess is rate-limiting game activity right now. Wait a few minutes, then sync again.")
    .trim();
}

export function formatSyncErrorForEvidence(kind: "game" | "puzzle", error: string) {
  const clean = formatQuestEvidence(error);
  if (/429|rate-?limit|rate-limiting|Too many requests/i.test(error)) {
    return `Lichess ${kind} sync paused because Lichess rate-limited the request. Wait a few minutes, then sync again.`;
  }
  if (/No real puzzle token|requires the student's Lichess login token/i.test(error)) {
    return "Puzzle quests update when the student syncs from their own logged-in Lichess account.";
  }
  return `Lichess ${kind} sync did not return fresh data. ${clean}`;
}
