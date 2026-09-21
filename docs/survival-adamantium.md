# Platinum and Adamantium Survival rewards

- Platinum focused-tactic and Chaos Mastery badges: 40 distinct hint-free solves in one round; **500 XP and 500 coins** for each newly earned badge.
- **Survival: Adamantium**: one universal badge at 50 distinct hint-free solves in one Survival round, regardless of selected theme or Survival variant; **1,000 XP and 1,000 coins once**. It is not a separate badge per theme. Stored tier `SS` displays as Adamantium.
- Temporary SVG artwork lives at `public/badges/survival-adamantium-placeholder.svg`.
- Existing badge ownership and historical rewards are retained; there is no retroactive top-up. Adamantium excludes rounds with attempts predating the new badge's creation. Daily, Woodpecker and other non-Survival training modes do not qualify.
- Bronze through Gold and unrelated tournament badges are unchanged.

Apply `20260921013738_survival_adamantium_rewards.sql` when releasing the code. It extends the tier constraints and existing Survival award function, adds an indexed XP-event reference to the badge award, and updates the round-rewards query. Positive XP already grants matching coins through the existing database trigger; only any remainder is granted directly, avoiding double coins. Amounts displayed for a completed round come from its recorded ledger entries, not the current catalog reward.

The existing per-student lock and unique badge award guarantee one-time payment. UI changes cover badge dialogs, the round-results panel, admin tier selection, profile badge mapping, and the collection's new Survival milestone card.

Verification: `node scripts/verify-adamantium-rewards.mjs` uses isolated PGlite with representative existing tables and the real migration. It checks focused, mixed and other Survival themes; 40/49/50 thresholds; hints; excluded modes; old rounds; duplicate retries; XP, coin and round-display totals. It uses the local PGlite install from the game-achievement verification setup and never connects to production.
