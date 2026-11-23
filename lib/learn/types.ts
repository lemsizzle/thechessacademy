export type LearnTopicId = "mate-in-one" | "hanging-piece" | "defensive-move" | "forks" | "pins" | "skewers";
export type LearnPosition = {
  topic: LearnTopicId;
  fen: string;
  kind: string;
  target?: string;
  focus?: string;
};
export type LearnPuzzle = LearnPosition & { id: string; solutions: string[] };
