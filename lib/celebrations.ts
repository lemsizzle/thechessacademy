export type Celebration = { id: string; kind: "badge" | "quest"; name: string };
export const CELEBRATION_EVENT = "academy-celebration";
export const REWARDS_CHANGED_EVENT = "academy-rewards-changed";

export function celebrate(celebration: Celebration) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CELEBRATION_EVENT, { detail: celebration }));
}
export function refreshCelebrations() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REWARDS_CHANGED_EVENT));
}

type Rect = { left: number; top: number; right: number; bottom: number };
export function celebrationPosition(width: number, height: number, boards: Rect[], mobile: boolean) {
  const cardWidth = Math.min(320, width - 24), cardHeight = 64;
  const bottom = height - (mobile ? 80 : 12) - cardHeight;
  const candidates = [
    { left: width - cardWidth - 12, top: bottom }, { left: 12, top: bottom },
    { left: width - cardWidth - 12, top: 12 }, { left: 12, top: 12 }
  ];
  return candidates.find(p => p.top >= 0 && !boards.some(b =>
    p.left < b.right + 8 && p.left + cardWidth > b.left - 8 && p.top < b.bottom + 8 && p.top + cardHeight > b.top - 8
  )) ?? null;
}
