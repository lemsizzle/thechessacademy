import type { Badge } from "@/lib/types";

// Stable order: append new entries; never reorder IDs already awarded to students.
const definitions = [
  ["first-fork", "Fork Finder", "Learning", 25, "Create a fork, then capture one of its targets with the forking piece on your next turn without immediately losing that piece."],
  ["successful-pin", "Pin and Win", "Learning", 25, "Pin a piece to its king, then capture that pinned piece on your next turn without an immediate recapture."],
  ["first-skewer", "Skewer Scout", "Learning", 25, "Check with a bishop, rook or queen aligned with another enemy piece, then capture the piece behind the king on your next turn."],
  ["discovered-attack", "Hidden Helper", "Learning", 25, "Move a blocker to reveal a bishop, rook or queen attack, then use that revealed piece to capture the target on your next turn."],
  ["back-rank-mate", "Back-Rank Hero", "Learning", 25, "Deliver rook or queen checkmate along the enemy back rank, with its king trapped by its own pieces on the rank in front."],
  ["first-promotion", "Pawn's Journey", "Learning", 25, "Promote a pawn in a completed game."],
  ["stalemate-escape", "Great Escape", "Learning", 25, "Be the stalemated player while behind in material by at least a pawn. Stalemate is a draw, not a win."],
  ["hanging-piece", "Watchful Eye", "Learning", 25, "Capture an undefended knight, bishop, rook or queen, and keep the capturing piece through the opponent's next move."],
  ["oh-no-my-queen", "Oh No My Queen", "Surprises", 50, "After your queen is captured, checkmate within your next three moves while the opponent still has a queen. No promoted queens in the game."],
  ["stalemate-tricks", "Stalemate Tricks", "Surprises", 50, "Escape with stalemate while at least four points behind, or at least two points behind outside a bishop-and-pawn-only ending."],
  ["rosen-trap", "Rosen Trap", "Surprises", 100, "Decline a legal king capture of a checking queen, move your king to a corner, then be stalemated on the next move."],
  ["castle-fork", "Castle Fork", "Surprises", 50, "Castle with check, then capture an enemy piece with your king on your next turn."],
  ["connect-5", "Connect 5", "Structures", 50, "Form an unbroken diagonal of five of your pawns."],
  ["pawn-diamond", "Pawn Diamond", "Structures", 50, "Arrange four of your pawns as a diamond: top, left, right and bottom."],
  ["connect-6", "Connect 6", "Structures", 100, "Form an unbroken diagonal of six of your pawns."],
  ["double-pawn-diamond", "Double Pawn Diamond", "Structures", 100, "Have at least two pawn diamonds at once; they may share pawns."],
  ["pawn-x", "Pawn X", "Structures", 50, "Arrange five of your pawns in a 3-by-3 X shape."],
  ["solid-pawn-diamond", "Solid Pawn Diamond", "Structures", 50, "Make a pawn diamond with a fifth pawn in its center."],
  ["pawn-cube", "Pawn Cube", "Structures", 50, "Arrange four of your pawns in a 2-by-2 square."],
  ["center-pawn-cube", "Center Pawn Cube", "Structures", 50, "Occupy d4, e4, d5 and e5 with your pawns."],
  ["quadrupled-pawns", "Quadrupled Pawns", "Structures", 50, "Have four of your pawns on one file."],
  ["connect-8-rank-4", "Connect 8 on 4th Rank", "Structures", 100, "Place all eight pawns on your fourth rank (rank 5 for Black)."],
  ["connect-8-rank-5", "Connect 8 on 5th Rank", "Structures", 100, "Place all eight pawns on your fifth rank (rank 4 for Black)."],
  ["connect-8-rank-6", "Connect 8 on 6th Rank", "Structures", 100, "Place all eight pawns on your sixth rank (rank 3 for Black)."],
  ["connect-8-rank-7", "Connect 8 on 7th Rank", "Structures", 100, "Place all eight pawns on your seventh rank (rank 2 for Black)."],
  ["six-pawns-file", "6 Pawns on the Same File", "Structures", 100, "Reach a position with six pawns on one file; both colors may contribute."],
  ["knight-cube", "Knight Cube", "Structures", 100, "Arrange four of your knights in a 2-by-2 square."],
  ["knight-rectangle", "Knight Rectangle", "Structures", 100, "Arrange six of your knights in a 2-by-3 or 3-by-2 rectangle."],
  ...([['egg','Egg'],['eggegg','Double Egg (EggEgg)'],['badegg','Bad Egg'],['beachcafe','BeachCafé'],['beef','Beef'],['cabbage','Cabbage'],['chad','Chad'],['headache','Headache']] as const).map(([word,name]) => ["alphabet-"+word,name,"Opening Curiosities",50,`Win after your opening moves spell “${word}” using the first letter of each move in standard chess notation (uppercase B means bishop).`] as const),
  ["pawn-mate", "Checkmate with a Pawn", "Checkmates", 50, "Make a non-promotion pawn move that delivers checkmate."],
  ["king-move-mate", "Checkmate with King", "Checkmates", 50, "Move your king (including castling) to reveal checkmate from another piece. Kings never directly check each other."],
  ["smothered-mate", "Smothered Mate", "Checkmates", 50, "Deliver knight checkmate with the enemy king surrounded on every on-board neighboring square by its own pieces."],
  ["smothered-pork", "Smothered Pork Checkmate", "Checkmates", 100, "Deliver smothered mate while your knight also attacks a queen or rook and an enemy pawn attacks the knight but cannot legally capture it."],
  ["en-passant-mate", "En Passant Checkmate", "Checkmates", 100, "Deliver checkmate with an en passant capture."],
  ["g5-mate", "g5#", "Checkmates", 100, "Deliver checkmate with a pawn move to g5."],
  ["double-check-mate", "Double-Check Checkmate", "Checkmates", 50, "Deliver checkmate with two pieces checking the king."],
  ["block-check-mate", "Block a Check with Checkmate", "Checkmates", 100, "Answer a check with a non-king, non-capturing move that blocks the check and delivers checkmate."],
  ["castle-kingside-mate", "O-O#", "Checkmates", 100, "Deliver checkmate by castling kingside."],
  ["castle-queenside-mate", "O-O-O#", "Checkmates", 100, "Deliver checkmate by castling queenside."],
  ["bishop-promotion-mate", "Promote to Bishop Checkmate", "Checkmates", 100, "Promote to a bishop with checkmate."],
  ["knight-promotion-mate", "Promote to Knight Checkmate", "Checkmates", 100, "Promote to a knight with checkmate."],
  ["bishop-knight-mate", "Bishop + Knight Checkmate", "Checkmates", 100, "Checkmate a lone king using only your king, one bishop and one knight."],
  ["two-bishop-mate", "2-Bishop Checkmate", "Checkmates", 50, "Deliver mate with only your king and two bishops remaining."],
  ["four-knight-mate", "4-Knight Checkmate", "Checkmates", 100, "Deliver mate with only your king and four knights remaining."],
  ["four-knight-cube-mate", "4-Knight Cube Checkmate", "Checkmates", 100, "Deliver mate with only your king and four knights arranged in a 2-by-2 square."],
  ["six-knight-rectangle-mate", "6-Knight Rectangle Checkmate", "Checkmates", 100, "Deliver mate with only your king and six knights arranged in a rectangle."],
  ...([2,3,4] as const).map(n => [`mate-move-${n}`,`Checkmate in ${n} Moves`,"Checkmates",50,`Deliver checkmate on full move ${n} from the standard starting position.`] as const),
  ["mona-lisa", "Mona Lisa Checkmate", "Checkmates", 100, "Checkmate with your original back-rank arrangement, no other friendly pieces, and only the enemy king on c2 (c7 for Black)."],
  ["late-castle", "Castle after Move 40", "Surprises", 50, "Castle on full move 41 or later."],
  ["early-promotion", "Promote a Pawn within 8 Moves", "Surprises", 100, "Promote a pawn by the end of full move 8."],
  ["peaceful-opening", "No Captures before Move 30", "Surprises", 50, "Reach White's 30th move without a capture on moves 1–29."],
  ["capture-chain", "10+ Consecutive Captures on the Same Square", "Surprises", 100, "Participate in ten consecutive half-moves that all capture on the same square."],
  ["pawn-storm", "12 Pawn Move Opening Win", "Opening Curiosities", 100, "Win after making only pawn moves on your first twelve turns."],
  ["royal-family-fork", "Royal Family Fork", "Surprises", 100, "Give a knight check that also attacks the enemy queen, a rook and at least one more non-pawn piece; the knight cannot be legally captured."],
  ["tenth-second-mate", "Checkmate with 0.1 seconds", "Clock Adventures", 100, "Checkmate with 0.10 seconds or less left in a game with no increment. Requires recorded move clocks."],
  ["avoid-flag-mate", "Avoid-the-Flag Checkmate", "Clock Adventures", 100, "Make your final twenty moves and checkmate after reaching 1.10 seconds or less, with no increment. Requires recorded move clocks."],
  ["adoption", "Adoption", "Match Streaks", 100, "Win ten consecutive eligible Academy games against the same opponent, with no intervening eligible Academy game against anyone else. Lichess imports do not count for streaks."],
  ["double-adoption", "Double Adoption", "Match Streaks", 100, "Win twenty consecutive eligible Academy games against the same opponent, with no intervening eligible Academy game against anyone else. Lichess imports do not count for streaks."],
  ["clutch-pawn", "Clutch Pawn", "Clock Adventures", 100, "Win on time with only a king and one pawn while at least ten material points behind."],
  ["minor-piece-flag", "Win with Insufficient Material", "Clock Adventures", 50, "Win on time with only a king and one bishop or knight, where the platform's rules permit the win because of the opponent's remaining material."],
  ["flag-mate-in-one", "Flag Opponent Who Had Mate in 1", "Clock Adventures", 50, "Win on time when the opponent, whose turn it is, had a legal checkmate in one."],
  ["lefong", "Lefong", "Surprises", 50, "Capture a recently developed fianchetto bishop with your bishop by move 10, without an immediate recapture, using the Lefong pattern."]
] as const;

export const gameAchievements = definitions.map(([key,name,group,xp,requirement], index) => ({
  key, name, group, xp, requirement,
  id: `ce550000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
}));
export const achievementByKey = new Map(gameAchievements.map(a => [a.key, a]));
export const achievementById = new Map(gameAchievements.map(a => [a.id, a]));
export function isGameAchievement(badge: Pick<Badge,"id">) { return achievementById.has(badge.id); }
export function achievementBadge(a: typeof gameAchievements[number]): Badge {
  return { id:a.id,name:a.name,description:a.group === "Learning" ? "A skill spotted in your own game." : "An unusual chess moment for your collection.",category:"Creativity",tier:a.xp===100?"Gold":a.xp===50?"Silver":"Bronze",xpValue:a.xp,unlockRequirement:a.requirement,visualTheme:"Chess Quest game achievement",artImageUrl:`/badges/game-achievements/${a.key}.svg`,finalImageUrl:null,generationStatus:"selected",isActive:true };
}
