export function formatQuestEvidence(evidence: string) {
  if (!evidence) return evidence;
  return evidence
    .replace(/<[^>]*>/g, " ")
    .replace(/https:\/\/http\.lichess\.org\/429/g, "")
    .replace(/\s+/g, " ")
    .replace(/Lichess game activity failed with 429:[^.]*\./, "Lichess is rate-limiting game activity right now. Wait a few minutes, then sync again.")
    .trim();
}
