import type { TimeControl } from "@/chess/types";

export const TIME_CONTROLS: TimeControl[] = [
  { id: "none", name: "No Clock", initialMs: null, incrementMs: 0 },
  { id: "10m", name: "10 min", initialMs: 10 * 60_000, incrementMs: 0 },
  { id: "10+5", name: "10 + 5", initialMs: 10 * 60_000, incrementMs: 5_000 },
  { id: "15+10", name: "15 + 10", initialMs: 15 * 60_000, incrementMs: 10_000 }
];
