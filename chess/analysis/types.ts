export const NAG_VALUES = ["!", "?", "!!", "??", "!?", "?!"] as const;
export type AnalysisNag = typeof NAG_VALUES[number];

export type AnalysisShape =
  | { type: "arrow"; from: string; to: string; style: "primary" | "secondary" | "warning" | "danger" }
  | { type: "circle"; square: string; style: "primary" | "secondary" | "warning" | "danger" };

export type SavedEngineEvaluation = {
  engine: "stockfish-18-lite";
  scoreWhiteCp: number | null;
  mateWhite: number | null;
  depth: number;
  pvUci: string[];
  pvSan: string;
  savedAt: string;
};

export type GuidedExercise = {
  prompt: string;
  expectedMovesUci: string[];
  successMessage: string;
};

export type AnalysisNode = {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  mainChildId: string | null;
  ply: number;
  fen: string;
  san: string | null;
  uci: string | null;
  origin: "original" | "analysis";
  comment: string;
  nags: AnalysisNag[];
  shapes: AnalysisShape[];
  referenceEvaluation?: SavedEngineEvaluation | null;
  guidedExercise?: GuidedExercise | null;
};

export type AnalysisTree = {
  schemaVersion: 1;
  rootId: string;
  nodes: Record<string, AnalysisNode>;
};

export type CompletedGameMove = {
  ply: number;
  color: "white" | "black";
  san: string;
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
};

export type CompletedGameRecord = {
  id: string;
  playerId: string;
  opponentName: string;
  playerColor: "white" | "black";
  result: "win" | "loss" | "draw";
  resultReason: string;
  initialFen: string;
  finalFen: string;
  pgn: string;
  moves: CompletedGameMove[];
  startedAt: string;
  completedAt: string;
  timeControl: { name?: string; initialSeconds?: number; incrementSeconds?: number };
};

export type StudySummary = {
  id: string;
  title: string;
  description: string;
  visibility: "private" | "shared";
  ownerKind: "student" | "admin";
  ownerStudentId: string | null;
  accessRole: "owner" | "editor" | "viewer";
  chapterCount: number;
  updatedAt: string;
};

export type StudyChapter = {
  id: string;
  studyId: string;
  title: string;
  sortOrder: number;
  initialFen: string;
  tree: AnalysisTree;
  sourceGameId: string | null;
  metadata: Record<string, unknown>;
  version: number;
  updatedAt: string;
};

export type StudyMember = {
  studentId: string;
  name: string;
  slug: string;
  lichessUsername?: string;
  role: "owner" | "editor" | "viewer";
};

export type ReviewAssignmentStatus = "assigned" | "submitted" | "returned" | "approved";
export type ReviewAnswerVisibility = "visible" | "after_completion" | "teacher_only";

export type ReviewAssignment = {
  id: string;
  studyId: string;
  chapterId: string | null;
  studentId: string;
  studentName: string;
  studyTitle: string;
  chapterTitle: string | null;
  prompt: string;
  teacherAnswer?: string;
  hasTeacherAnswer: boolean;
  answerVisibility: ReviewAnswerVisibility;
  answerRevealed: boolean;
  studentResponse: string;
  teacherFeedback: string;
  status: ReviewAssignmentStatus;
  assignedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};
