export type TrainingRewardReceipt = { id: string; xp: number; coins: number };
export type TrainingRewardTally = {
  xp: number;
  coins: number;
  receipts: Record<string, { xp: number; coins: number }>;
};

export function emptyTrainingTally(): TrainingRewardTally {
  return { xp: 0, coins: 0, receipts: {} };
}

// Receipts may be cumulative (Star Wars) or repeated after a lost response.
// Keep their high-water marks even when the visible tally is reset.
export function applyTrainingReceipt(tally: TrainingRewardTally, receipt: TrainingRewardReceipt): TrainingRewardTally {
  if (!receipt.id || !Number.isSafeInteger(receipt.xp) || !Number.isSafeInteger(receipt.coins)
    || receipt.xp < 0 || receipt.coins < 0) return tally;
  const previous = Object.hasOwn(tally.receipts, receipt.id) ? tally.receipts[receipt.id] : { xp: 0, coins: 0 };
  const xp = Math.max(previous.xp, receipt.xp), coins = Math.max(previous.coins, receipt.coins);
  if (xp === previous.xp && coins === previous.coins) return tally;
  return { xp: tally.xp + xp - previous.xp, coins: tally.coins + coins - previous.coins,
    receipts: { ...tally.receipts, [receipt.id]: { xp, coins } } };
}

export function restoreTrainingTally(value: string | null): TrainingRewardTally {
  try {
    const parsed = JSON.parse(value ?? "null") as TrainingRewardTally | null;
    if (!parsed || !Number.isSafeInteger(parsed.xp) || parsed.xp < 0
      || !Number.isSafeInteger(parsed.coins) || parsed.coins < 0 || !parsed.receipts || typeof parsed.receipts !== "object") return emptyTrainingTally();
    const checked = Object.entries(parsed.receipts).reduce((tally, [id, amounts]) => applyTrainingReceipt(tally, { ...amounts, id }), emptyTrainingTally());
    return { ...checked, xp: Math.min(checked.xp, parsed.xp), coins: Math.min(checked.coins, parsed.coins) };
  } catch { return emptyTrainingTally(); }
}

export function createTrainingRewardStore(storageKey: string, storage?: Pick<Storage, "getItem" | "setItem">) {
  let tally = emptyTrainingTally();
  let loaded = false;
  const listeners = new Set<() => void>();
  function load() {
    if (loaded) return;
    loaded = true;
    try { tally = restoreTrainingTally(storage?.getItem(storageKey) ?? null); } catch { /* In-memory tally still works. */ }
  }
  function save(next: TrainingRewardTally) {
    if (next === tally) return;
    tally = next;
    try { storage?.setItem(storageKey, JSON.stringify(tally)); } catch { /* Storage must never interrupt a move. */ }
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => { load(); return tally; },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    record: (receipt: TrainingRewardReceipt) => { load(); save(applyTrainingReceipt(tally, receipt)); },
    reset: () => { load(); save({ ...tally, xp: 0, coins: 0 }); }
  };
}
