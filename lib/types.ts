export type BadgeTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "C" | "B" | "A" | "S";

export type BadgeCategory =
  | "Concepts"
  | "Tactics"
  | "Checkmates"
  | "Openings"
  | "Endgames"
  | "Tournament"
  | "Sportsmanship"
  | "Creativity"
  | "Boss Achievements";

export type TacticTheme =
  | "Fork"
  | "Pin"
  | "Skewer"
  | "Discovered Attack"
  | "Double Attack"
  | "Deflection"
  | "Decoy"
  | "Removing the Defender"
  | "Back Rank Mate"
  | "Mate in One";

export type ConceptTheme =
  | "Opening Principles"
  | "King Safety"
  | "Piece Development"
  | "Center Control"
  | "Pawn Structure"
  | "Passed Pawn"
  | "Weak Squares"
  | "Rook on the Seventh"
  | "Opposition"
  | "Endgame Technique";

export type GenerationStatus = "idle" | "pending" | "generated" | "selected" | "error";

export type Badge = {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  tacticTheme?: TacticTheme;
  conceptTheme?: ConceptTheme;
  tier?: BadgeTier;
  xpValue: number;
  unlockRequirement: string;
  requiredPuzzleCount?: number;
  visualTheme: string;
  imagePrompt?: string;
  artImageUrl: string | null;
  finalImageUrl: string | null;
  generationStatus: GenerationStatus;
  generationError?: string;
  isActive?: boolean;
  isLegacy?: boolean;
  createdAt?: string;
};

export type Student = {
  id: string;
  slug: string;
  lichessUsername?: string;
  name: string;
  avatar: string;
  classGroup: string;
  source?: "manual" | "outschool";
  outschoolLearnerId?: string;
  isActive?: boolean;
  onboardingCompleted?: boolean;
  totalXp: number;
  badgeIds: string[];
  completedQuestIds?: string[];
  encouragement: string;
};

export type UserRole = "admin" | "student";

export type StudentUser = {
  id: string;
  studentId: string;
  name: string;
  email: string;
  role: "student";
  lichessUsername?: string;
  onboardingCompleted?: boolean;
};

export type StudentSession = {
  id: string;
  studentId: string;
  role: "student";
  name: string;
  lichessUserId: string;
  lichessUsername: string;
  onboardingCompleted: boolean;
  createdAt: string;
  expiresAt: string;
};

export type StudentAuthAccount = {
  id: string;
  studentId: string;
  provider: "lichess";
  providerUserId: string;
  providerUsername: string;
  createdAt: string;
  updatedAt: string;
};

export type LichessOAuthProfile = {
  id: string;
  username: string;
  profileUrl: string;
  blitzRating: number | null;
  blitzGames: number;
  blitzRatingChange: number | null;
  blitzRatingDeviation: number | null;
  blitzProvisional: boolean;
  rapidRating: number | null;
  rapidGames: number;
  rapidRatingChange: number | null;
  rapidRatingDeviation: number | null;
  rapidProvisional: boolean;
  puzzleRating?: number | null;
  puzzleGames?: number;
};

export type StudentOnboardingInput = {
  displayName: string;
  classGroup: string;
  avatar?: string;
};

export type ClassGroup = {
  id: string;
  name: string;
  outschoolClassUrl: string;
  outschoolSectionId?: string;
  syncStatus: "not-connected" | "linked" | "mock-sync";
  lastSyncedAt?: string;
};

export type QuestStatus = "available" | "in-progress" | "completed";
export type QuestType = "weekly" | "boss";
export type QuestSource = "lichess_games" | "lichess_puzzles" | "lichess_tournaments" | "internal_submission" | "manual";
export type QuestConditionType =
  | "rated_win_count"
  | "rated_games_played_count"
  | "rapid_win_count"
  | "rapid_games_played_count"
  | "blitz_win_count"
  | "blitz_games_played_count"
  | "puzzle_solved_count"
  | "puzzle_attempted_count"
  | "puzzle_accuracy_threshold"
  | "puzzle_theme_solved_count"
  | "arena_score_threshold"
  | "tournament_participation"
  | "rating_peak"
  | "manual";
export type QuestTimeWindow = "daily" | "weekly" | "monthly" | "tournament" | "all_time" | "custom";

export type Quest = {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  isLive?: boolean;
  xpReward: number;
  badgeRewardId?: string;
  classGroup?: string;
  category?: string;
  source?: QuestSource;
  conditionType?: QuestConditionType;
  timeWindow?: QuestTimeWindow;
  requiredCount?: number;
  requiredScore?: number;
  requiredAccuracy?: number;
  requiredTheme?: TacticTheme;
  approvalRequired?: boolean;
  isActive?: boolean;
  isRepeatable?: boolean;
  cooldownDays?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type LichessQuestGame = {
  id: string;
  playedAt: string;
  perfType: "rapid" | "blitz" | string;
  rated: boolean;
  finished: boolean;
  turns: number;
  moveCount: number;
  won: boolean;
};

export type LichessQuestPuzzleActivity = {
  puzzleId: string;
  date: string;
  win: boolean;
  themes: string[];
};

export type LichessQuestProgress = {
  studentId: string;
  questId: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  currentValue: number;
  requiredValue: number;
  accuracy?: number;
  completed: boolean;
  evidence: string;
  mode: "connected" | "mock";
  updatedAt: string;
};

export type PendingQuestAwardStatus = "pending" | "approved" | "rejected";

export type PendingQuestAward = {
  id: string;
  studentId: string;
  questId: string;
  source: QuestSource;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  title: string;
  description: string;
  xpAmount: number;
  badgeId?: string;
  evidence: string;
  status: PendingQuestAwardStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
};

export type QuestCompletionEvent = {
  id: string;
  studentId: string;
  questId: string;
  awardId: string;
  completedAt: string;
  source: QuestSource;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  xpAwarded: number;
  badgeAwardedId?: string;
  evidence: string;
};

export type StudentQuestAttemptStatus = "active" | "expired" | "completed";

export type StudentQuestAttempt = {
  id: string;
  studentId: string;
  questId: string;
  startedAt: string;
  expiresAt: string;
  status: StudentQuestAttemptStatus;
  createdAt: string;
};

export type LichessActivitySnapshot = {
  id: string;
  studentId: string;
  source: QuestSource;
  periodStart: string;
  periodEnd: string;
  data: Record<string, unknown>;
  mode: "connected" | "mock";
  createdAt: string;
};

export type XpEvent = {
  id: string;
  studentId: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export type StudentTacticProgress = {
  studentId: string;
  tacticTheme: TacticTheme;
  puzzlesSolved: number;
  puzzleSolvedCount?: number;
  submittedGameFoundCount?: number;
  totalCount?: number;
  updatedAt?: string;
};

export type LichessConnection = {
  studentId: string;
  lichessUsername: string;
  connectedAt: string;
  lastSyncedAt?: string;
  status: "mock" | "connected" | "needs-auth";
};

export type LichessSyncStatus = "mock" | "connected" | "needs-auth" | "rate-limited" | "error";

export type LichessRatingPerf = {
  rating: number | null;
  games: number;
  ratingChange: number | null;
  ratingDeviation: number | null;
  provisional: boolean;
};

export type StudentLichessAccount = {
  id: string;
  studentId: string;
  lichessUserId: string;
  lichessUsername: string;
  lichessProfileUrl: string;
  accessTokenEncrypted?: string;
  scopes?: string[];
  blitzRating: number | null;
  blitzGames: number;
  blitzRatingChange: number | null;
  blitzRatingDeviation: number | null;
  blitzProvisional: boolean;
  rapidRating: number | null;
  rapidGames: number;
  rapidRatingChange: number | null;
  rapidRatingDeviation: number | null;
  rapidProvisional: boolean;
  puzzleRating?: number | null;
  puzzleGames?: number;
  blitzWins?: number;
  rapidWins?: number;
  puzzleCorrect?: number;
  peakBlitzRating?: number;
  peakRapidRating?: number;
  peakPuzzleRating?: number;
  baselineBlitzRating?: number;
  baselineRapidRating?: number;
  baselinePuzzleRating?: number;
  baselineBlitzGames?: number;
  baselineRapidGames?: number;
  baselinePuzzleGames?: number;
  baselineBlitzWins?: number;
  baselineRapidWins?: number;
  baselinePuzzleCorrect?: number;
  activityBaselineSetAt?: string;
  linkedAt: string;
  lastRatingSyncAt?: string;
  lastPuzzleSyncAt?: string;
  lastGameSyncAt?: string;
  syncStatus: LichessSyncStatus;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LichessPuzzleActivity = {
  puzzleId: string;
  date: string;
  themes: string[];
  rating?: number;
};

export type PendingAwardStatus = "pending" | "approved" | "rejected";

export type PendingAward = {
  id: string;
  studentId: string;
  source: "lichess";
  tacticTheme: TacticTheme;
  badgeId: string;
  badgeName: string;
  xpValue: number;
  puzzlesSolved: number;
  status: PendingAwardStatus;
  createdAt: string;
};

export type LichessSyncLog = {
  id: string;
  studentId?: string;
  level: "info" | "warning" | "error";
  message: string;
  createdAt: string;
};

export type GameReviewSubmissionStatus = "pending_review" | "approved" | "rejected" | "analysed";
export type GameReviewSubmissionType = "tactic_review" | "analysis_request";

export type GameReviewSubmission = {
  id: string;
  studentId: string;
  studentName: string;
  gameUrl: string;
  requestType: GameReviewSubmissionType;
  tacticTheme?: TacticTheme;
  moveNumber?: number;
  studentNote?: string;
  status: GameReviewSubmissionStatus;
  createdAt: string;
  reviewedAt?: string;
  teacherNote?: string;
};

export type SubmissionStatus = "pending" | "approved" | "rejected" | "needs_changes";
export type SubmissionReviewAction = "approve" | "reject" | "needs_changes";

export type StudentGameSubmission = {
  id: string;
  studentId: string;
  gameUrl: string;
  platform: "lichess";
  lichessGameId: string;
  playedAs: "white" | "black" | "unknown";
  gameType?: string;
  opponentName?: string;
  notes?: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  teacherNote?: string;
  rejectionReason?: string;
  linkedAnalysisRequestId?: string;
};

export type StudentScoreSubmission = {
  id: string;
  studentId: string;
  challengeName: string;
  tacticTheme: TacticTheme;
  score: number;
  totalQuestions?: number;
  timeLimit?: string;
  platform?: string;
  screenshotUrl?: string;
  notes?: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  teacherNote?: string;
  rejectionReason?: string;
  xpAwarded?: number;
  tacticProgressAdded?: number;
};

export type TacticConfidence = "low" | "medium" | "high";
export type DetectionMethod = "rule_based" | "eval_assisted" | "ai_assisted" | "manual_admin";
export type GameAnalysisStatus = "pending_review" | "approved" | "rejected" | "ignored";
export type StudentColor = "white" | "black" | "auto";

export type LichessGame = {
  gameId: string;
  url: string;
  whiteUsername: string;
  blackUsername: string;
  whiteRating?: number;
  blackRating?: number;
  speed?: string;
  perfType?: string;
  rated: boolean;
  result?: string;
  winner?: "white" | "black";
  opening?: string;
  moves: string;
  pgn?: string;
  finalFen?: string;
  rawData?: unknown;
};

export type GameAnalysisRequest = {
  id: string;
  studentId: string;
  lichessGameId: string;
  lichessUrl: string;
  studentColor: StudentColor | "white" | "black";
  status: "pending_review" | "completed" | "error";
  requestedBy: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  rawGameData?: unknown;
};

export type GameTacticFinding = {
  id: string;
  analysisRequestId: string;
  studentId: string;
  lichessGameId: string;
  moveNumber: number;
  moveSan: string;
  moveUci?: string;
  tacticTheme: TacticTheme;
  confidence: TacticConfidence;
  detectionMethod: DetectionMethod;
  fenBefore: string;
  fenAfter: string;
  aiExplanationTeacher: string;
  aiExplanationStudent: string;
  whyThisMoveWorks?: string;
  suggestedBadgeProgress?: string;
  cautionIfUncertain?: string;
  status: GameAnalysisStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  teacherNote?: string;
  rejectionReason?: string;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  title: string;
  detail: string;
  createdAt: string;
};

export type ResourceCategory =
  | "Practice"
  | "Puzzles"
  | "Openings"
  | "Endgames"
  | "Videos"
  | "Tools"
  | "Parent Info"
  | "Class Materials";

export type ResourceStatus = "active" | "inactive" | "archived";

export type Resource = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: ResourceCategory;
  status: ResourceStatus;
  featured: boolean;
  classGroup?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type TournamentStatus = "upcoming" | "ongoing" | "finished" | "unknown";
export type TournamentSource = "team_sync" | "imported_url" | "manual_fallback";

export type Tournament = {
  id: string;
  lichessId?: string;
  name: string;
  description?: string;
  status: TournamentStatus;
  startsAt: string;
  endsAt?: string;
  durationMinutes?: number;
  url: string;
  teamId?: string;
  createdBy?: string;
  rated?: boolean;
  variant?: string;
  speed?: string;
  timeControl?: string;
  playerCount?: number;
  source: TournamentSource;
  isActive?: boolean;
  isPublic?: boolean;
  rawData?: unknown;
  syncedAt?: string;
  importedAt?: string;
};

export type ArenaTournamentResult = {
  id: string;
  tournamentId: string;
  lichessTournamentId: string;
  studentId?: string;
  lichessUsername: string;
  rank: number;
  score: number;
  rating?: number;
  performance?: number;
  matched: boolean;
  tournamentStartsAt?: string;
  rawData?: unknown;
  importedAt: string;
};

export type TournamentAwardStatus = "pending" | "approved" | "rejected";

export type PendingTournamentAward = {
  id: string;
  studentId: string;
  tournamentId: string;
  lichessTournamentId: string;
  lichessUsername: string;
  title: string;
  description: string;
  xpAmount: number;
  reason: string;
  tournamentSource?: TournamentSource;
  status: TournamentAwardStatus;
  teacherNote?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
};
