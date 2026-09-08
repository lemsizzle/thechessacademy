export type SurvivalRoundBadge = {
  badgeId: string;
  name: string;
  tier: string;
  category: string;
  imageUrl: string | null;
  coins: number;
};

export type SurvivalRoundRewards = {
  xp: number;
  puzzleCoins: number;
  badgeCoins: number;
  badges: SurvivalRoundBadge[];
};
