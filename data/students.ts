import type { Student } from "@/lib/types";

export const students: Student[] = [
  {
    id: "stu-001",
    slug: "arina",
    lichessUsername: "arina",
    name: "Arina",
    avatar: "A",
    classGroup: "Saturday Knights",
    totalXp: 880,
    badgeIds: ["tactic-fork-bronze", "tactic-back-rank-mate-bronze", "concept-opening-principles", "concept-center-control", "fork-apprentice", "opening-principles", "pawn-promotion", "puzzle-streak"],
    encouragement: "Your tactical vision is sharpening. Keep checking forcing moves before every capture."
  },
  {
    id: "stu-002",
    slug: "leo",
    lichessUsername: "leo",
    name: "Leo",
    avatar: "L",
    classGroup: "Wednesday Bishops",
    totalXp: 1270,
    badgeIds: ["tactic-fork-bronze", "tactic-fork-silver", "tactic-fork-gold", "tactic-double-attack-bronze", "tactic-mate-in-one-bronze", "tactic-mate-in-one-silver", "concept-king-safety", "concept-piece-development", "fork-apprentice", "fork-master", "back-rank-mate", "hand-and-brain-hero"],
    encouragement: "You are playing with brave energy. Add one quiet safety check before launching attacks."
  },
  {
    id: "stu-003",
    slug: "maya",
    lichessUsername: "maya",
    name: "Maya",
    avatar: "M",
    classGroup: "Saturday Knights",
    totalXp: 620,
    badgeIds: ["tactic-pin-bronze", "tactic-removing-the-defender-bronze", "concept-pawn-structure", "opening-principles", "endgame-survivor", "calm-under-pressure"],
    encouragement: "Your endgame patience is becoming a real weapon. Keep trusting your king activity."
  },
  {
    id: "stu-004",
    slug: "noah",
    lichessUsername: "noah",
    name: "Noah",
    avatar: "N",
    classGroup: "Monday Pawns",
    totalXp: 340,
    badgeIds: ["tactic-mate-in-one-bronze", "concept-opening-principles", "pawn-promotion", "puzzle-streak"],
    encouragement: "Every puzzle streak is building your calculation muscles. Hunt for checks first."
  },
  {
    id: "stu-005",
    slug: "sophia",
    lichessUsername: "sophia",
    name: "Sophia",
    avatar: "S",
    classGroup: "Wednesday Bishops",
    totalXp: 2050,
    badgeIds: ["tactic-deflection-bronze", "tactic-deflection-silver", "tactic-decoy-bronze", "tactic-back-rank-mate-bronze", "tactic-back-rank-mate-silver", "tactic-back-rank-mate-gold", "concept-opposition", "concept-endgame-technique", "fork-apprentice", "deflection", "two-bishop-checkmate", "comeback-king", "tournament-warrior"],
    encouragement: "You are entering boss-quest territory. Keep converting advantages with calm technique."
  }
];
