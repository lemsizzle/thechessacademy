export type ChessColor = "white" | "black";

export type PlayerColorChoice = ChessColor | "random";

export type PromotionPiece = "q" | "r" | "b" | "n";

export type BotErrorBand = {
  minCpLoss: number;
  maxCpLoss: number;
  weight: number;
  complexityMultiplier: number;
};

export type BotPersonality = {
  checks: number;
  captures: number;
  threats: number;
  development: number;
  center: number;
  castling: number;
  safety: number;
  defense: number;
  simplification: number;
  knights: number;
  pawnMoves: number;
  edgePawns: number;
  earlyQueen: number;
  repeatedPiece: number;
  unforcedKing: number;
};

export type BotDifficulty = {
  id: string;
  name: string;
  title: string;
  estimatedRating: number;
  multiPv: number;
  thinkTimeMs: number;
  tacticalAwareness: number;
  complexitySensitivity: number;
  qualityDiscipline: number;
  selectionTemperature: number;
  maxPlausibleCpLoss: number;
  errorBands: BotErrorBand[];
  personality: BotPersonality;
  description: string;
};

export type StockfishCandidate = {
  uci: string;
  rank: number;
  depth: number;
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
  bound?: "lower" | "upper";
};

export type BotMoveContext = {
  moveHistory: string[];
};

export type TimeControl = {
  id: string;
  name: string;
  initialMs: number | null;
  incrementMs: number;
};

export type GameResult = "win" | "loss" | "draw";

export type GameResultReason =
  | "checkmate"
  | "stalemate"
  | "resignation"
  | "timeout"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "insufficient_material"
  | "draw";

export type GameOutcome = {
  result: GameResult;
  reason: GameResultReason;
  winnerColor: ChessColor | null;
  title: string;
  message: string;
};

export type GameMove = {
  ply: number;
  color: ChessColor;
  san: string;
  from: string;
  to: string;
  promotion?: PromotionPiece;
  fenAfter: string;
};

export type ComputerGameConfig = {
  bot: BotDifficulty;
  humanColor: ChessColor;
  timeControl: TimeControl;
};

export type ClockSnapshot = {
  whiteMs: number;
  blackMs: number;
  activeColor: ChessColor;
};
