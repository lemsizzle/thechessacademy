export type StudentUpdate = {
  id: string;
  date: string; // YYYY-MM-DD: first available to students, not the date of a later edit.
  category: "Feature" | "Badges" | "Avatar Store" | "Quest";
  title: string;
  description: string;
};

// Student-facing release notes. Add an entry when shipping a feature or publishing
// catalog content. Dates were checked against main's release history and the live
// catalog; database creation can precede the release that makes an item usable.
// Keep this independent of gameplay/data APIs: opening the popup needs no DB read.
export const studentUpdates: readonly StudentUpdate[] = [
  { id: "feature-badge", date: "2026-10-09", category: "Feature", title: "Feature your favorite badge", description: "Open an earned badge in your Trophy Case and choose Feature badge to show it beside your name on your profile, leaderboard, and game boards." },
  { id: "try-hard", date: "2026-10-09", category: "Badges", title: "Try Hard", description: "New Gold and Platinum badges challenge you to win 5 or 10 consecutive games in one Academy tournament. Draws and losses break the streak. See Badges for the full requirements." },
  { id: "study-drafts", date: "2026-10-06", category: "Feature", title: "Recover your Study drafts", description: "Unfinished Study edits can be recovered after a reload, with recovery support when you switch devices." },
  { id: "puzzle-dashboard", date: "2026-10-05", category: "Feature", title: "Your Puzzle Dashboard", description: "Explore your puzzle history, theme strengths, and areas to practise. Replay missed or helped puzzles privately, with Next and Auto-advance controls." },
  { id: "game-history", date: "2026-09-30", category: "Feature", title: "Game history and analysis", description: "Choose Analyze game after playing, or open your recent games from Play's game history. The analysis board now has more room for reviewing moves and key moments." },
  { id: "academy-progress", date: "2026-09-30", category: "Feature", title: "Your progress belongs to Chess Quest", description: "Games and training inside Chess Quest drive your progress. Lichess is used for login; you no longer need to sync Lichess activity to grow here." },
  { id: "tournament-chat", date: "2026-09-28", category: "Feature", title: "Tournament chat during games", description: "Keep up with the tournament chat room while playing your tournament game." },
  { id: "training-rewards", date: "2026-09-28", category: "Feature", title: "Rewards for finding stars", description: "Earn 3 XP and 3 coins for each Star Wars level, and 10 XP and 10 coins when you find all stars in a Hide and Seek round." },
  { id: "crimson-sentinel", date: "2026-09-23", category: "Avatar Store", title: "Crimson Sentinel Mask", description: "A new headwear item is available to preview and buy in the Avatar Store." },
  { id: "purchase-equip", date: "2026-09-23", category: "Feature", title: "Purchase and equip", description: "Buy a store item and equip it in one step. The avatar preview stays visible while you browse." },
  { id: "easy-medium-puzzles", date: "2026-09-23", category: "Feature", title: "More easy and medium puzzles", description: "The training pool has grown, with more puzzles at easy and medium levels. Auto-advance preloads the next puzzle to keep your practice moving." },
  { id: "achievement-celebrations", date: "2026-09-23", category: "Feature", title: "Small celebrations for big progress", description: "New badges and completed quests get a short congratulations message that leaves the board visible and fades after 3 seconds." },
  { id: "adamantium-art", date: "2026-09-22", category: "Badges", title: "Adamantium artwork", description: "Survival: Adamantium now has its finished badge artwork. Open it from the badge list or your Trophy Case for a closer look." },
  { id: "badge-catalog", date: "2026-09-22", category: "Feature", title: "Find your next badge", description: "The Badges page lists numbered requirements in Puzzle, Gameplay, and Special Conditions sections. Click a badge name to see its artwork." },
  { id: "adamantium", date: "2026-09-21", category: "Badges", title: "Survival: Adamantium", description: "Solve 50 different puzzles without hints in one Survival round, in any theme or variant, to earn 1,000 XP and 1,000 coins once. Platinum puzzle tiers now award 500 XP and 500 coins." },
  { id: "game-achievements", date: "2026-09-21", category: "Badges", title: "Automatic game achievements", description: "Collect badges with XP and coins for tactics, promotions, unusual checkmates, pawn patterns, and other memorable moments in completed eligible Academy games. Each badge lists its exact requirements." },
  { id: "loss-messages", date: "2026-09-21", category: "Feature", title: "A little encouragement after a loss", description: "Ten encouraging messages rotate after game losses, with room to see the final position and learn from it." },
  { id: "cancel-premove", date: "2026-09-16", category: "Feature", title: "Cancel a premove with a tap", description: "Click or tap the board to cancel a queued premove before it plays." },
  { id: "king-rook-castle", date: "2026-09-15", category: "Feature", title: "Another way to castle", description: "When castling is legal, place your king on its rook to castle. The usual king destination still works." },
  { id: "board-circles", date: "2026-09-15", category: "Feature", title: "Mark squares with circles", description: "Right-click a square to add or remove a circle on chessboards, except Hide and Seek. Right-drag still draws an arrow." },
  { id: "tournament-analysis", date: "2026-09-14", category: "Feature", title: "Replay tournament results", description: "Open a recent result in the tournament lobby to review that game on an analysis board." },
  { id: "puzzle-streaker", date: "2026-09-13", category: "Quest", title: "Puzzle Streaker", description: "Start this quest, then reach a 15-puzzle streak in one Survival run to earn 150 XP and 150 coins. A wrong move resets the streak." },
  { id: "september-avatar-items", date: "2026-09-13", category: "Avatar Store", title: "A hat, a mask, and a beach", description: "Luffy's Straw Hat, Deku's Mask, and the Sunny Beach background have joined the store." },
  { id: "naruto-set", date: "2026-09-12", category: "Avatar Store", title: "Naruto Chess Set", description: "A Mythic board and matching pieces bring a shinobi style to your games." },
  { id: "vagabond-champion", date: "2026-09-11", category: "Badges", title: "Vagabond Champion", description: "Buy both Cardboard Crown and the cardboard shirt named You Will Be Poor After This Purchase to earn this special-condition badge." },
  { id: "chaos-mastery", date: "2026-09-10", category: "Badges", title: "Chaos Mastery", description: "New Bronze, Silver, Gold, and Platinum badges celebrate hint-free Survival progress in Chaos mode. Your earned tiers appear together in the Trophy Case." },
  { id: "arena-legends", date: "2026-09-09", category: "Badges", title: "Arena Legends", description: "Collect Bronze Contender for 3rd place, Silver Challenger for 2nd, Golden Champion for 1st, and Platinum Dynasty for winning 5 distinct Academy tournaments." },
  { id: "variant-rankings", date: "2026-09-09", category: "Feature", title: "Training variant rankings", description: "Compare Survival results by training variant and find players together in the Arena lobby." },
  { id: "arena-berserk", date: "2026-09-08", category: "Feature", title: "Berserk in the Arena", description: "Take on the tournament's Berserk challenge, with computer opponents available when your teacher includes them." },
  { id: "eight-bit-set", date: "2026-09-07", category: "Avatar Store", title: "8-Bit Chess Set", description: "An Epic pixel-style board and matching pieces are available in the store." },
  { id: "live-challenges", date: "2026-09-07", category: "Feature", title: "Challenge online students", description: "Send a direct live-game challenge to another online student from Play." },
  { id: "survival-tactic-badges", date: "2026-09-06", category: "Badges", title: "Survival tactic badges and Trophy Case", description: "Earn tactic tiers in focused, hint-free Survival rounds. Your dashboard Trophy Case groups earned tiers and opens larger badge details with illustrated artwork." },
  { id: "paper-blossom-sets", date: "2026-09-06", category: "Avatar Store", title: "Paper and Blossom Chess Sets", description: "Choose a folded-paper style or a blossom-themed board and matching pieces in the store." },
  { id: "september-hair-staff", date: "2026-09-06", category: "Avatar Store", title: "Fresh hairstyles and a Wizard Staff", description: "Try Braided Crown, Textured Taper Fade, Twin Space Buns, Wavy Side Sweep, and the Wizard Staff accessory." },
  { id: "wooden-sounds", date: "2026-09-06", category: "Feature", title: "Wooden chess move sounds", description: "Chess moves now have wooden-piece sounds, with sound controls for quiet practice." },
  { id: "cardboard-outfit", date: "2026-09-04", category: "Avatar Store", title: "The cardboard outfit", description: "Cardboard Crown and the shirt You Will Be Poor After This Purchase are available in the store." },
  { id: "catcher-of-stars", date: "2026-09-01", category: "Quest", title: "Catcher of Stars", description: "Start this quest and reach Level 15 in Star Wars." },
  { id: "hide-seek-time-trial", date: "2026-09-01", category: "Feature", title: "Hide and Seek time trial", description: "Test your board vision against the clock in Hide and Seek's time trial." },
  { id: "chess-adventure", date: "2026-08-31", category: "Feature", title: "Chess Adventure", description: "Arrive in Pawnhaven, meet its residents, and use chess challenges to begin restoring the village." },
  { id: "hide-and-seek", date: "2026-08-29", category: "Feature", title: "Hide and Seek", description: "Practise board vision by finding hidden stars, and compare your results on the leaderboards." },
  { id: "bot-progression", date: "2026-08-29", category: "Feature", title: "Climb the computer-opponent ladder", description: "Beat computer opponents to unlock your next challenge." },
  { id: "correspondence", date: "2026-08-29", category: "Feature", title: "Correspondence challenges", description: "Challenge another student to a game you can play one turn at a time, with reminders when a move is waiting." },
  { id: "woodpecker-quest", date: "2026-08-28", category: "Quest", title: "Conquer the Woodpecker", description: "Start this quest and finish all three cycles of one 20-puzzle Woodpecker set." },
  { id: "august-fantasy-items", date: "2026-08-28", category: "Avatar Store", title: "Anime-inspired avatar items", description: "Akatsuki Robe, Gojo's Blindfold, Super Saiyan Hair, Chess Domain, and Domain Expansion are available to preview in the store." },
  { id: "star-wars", date: "2026-08-27", category: "Feature", title: "Star Wars training", description: "Plan routes across the board to collect stars through a growing series of chess movement challenges." },
  { id: "academy-arena", date: "2026-08-27", category: "Feature", title: "Academy Arena tournaments", description: "Join in-app tournaments through a live lobby, play Academy opponents, and follow the standings." },
  { id: "august-avatar-hair", date: "2026-08-26", category: "Avatar Store", title: "More hair and expressions", description: "Curly Hair, Short 'fro, Long 'fro, Elegant Arched Brows, Thick Uni-Brow, Smirk Mouth, and the Impossibru Arches, Grimace, and Squint expand your avatar choices." },
  { id: "august-avatar-magic", date: "2026-08-26", category: "Avatar Store", title: "Magical avatar details", description: "Add Boy Who Lived Scar, Mangekyo Sharingan Eyes, a Pocket Mantis, or the Super Saiyan aura to your avatar." },
  { id: "sir-lem-quest", date: "2026-08-24", category: "Quest", title: "Beat Sir Lem", description: "Take on the coach's computer clone in this Academy quest." },
  { id: "bot-win-quests", date: "2026-08-23", category: "Quest", title: "Beat the Pawn 5x and Beat the Knight", description: "New quests reward you for beating the Pawn bot 5 times or the Knight bot twice after starting the matching quest." },
  { id: "woodpecker-adaptive", date: "2026-08-22", category: "Feature", title: "Woodpecker and mistake practice", description: "Repeat a puzzle set over Woodpecker cycles, or use adaptive review to practise mistakes from your games and Survival rounds." },
  { id: "daily-puzzle", date: "2026-08-22", category: "Feature", title: "A daily puzzle", description: "Come back for a daily chess challenge inside the Academy." },
  { id: "play-studies", date: "2026-08-21", category: "Feature", title: "Play, analyze, and study inside Chess Quest", description: "Play computer or live student games, explore moves on analysis boards, and work through teacher Studies and guided exercises." }
];

export function studentUpdateDate(date: Date) {
  // Use the academy's date consistently, even for students in another time zone.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function studentUpdateCutoff(now: Date) {
  const [year, month, day] = studentUpdateDate(now).split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 3, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function getRecentStudentUpdates(now = new Date(), updates: readonly StudentUpdate[] = studentUpdates) {
  const today = studentUpdateDate(now);
  const cutoff = studentUpdateCutoff(now);
  return updates.filter((entry) => entry.date >= cutoff && entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function formatStudentUpdateDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
