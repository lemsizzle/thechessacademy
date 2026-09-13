-- Apply after deploying support for internal_survival_streak_reached.
-- XP awards also grant Academy Coins 1:1 through the existing reward flow.
insert into public.academy_quests (
  id, title, description, type, status, is_live, xp_reward, completion_url,
  category, source, condition_type, time_window, required_count,
  approval_required, is_active, is_repeatable, cooldown_days
) values (
  'academy-puzzle-streaker', 'Puzzle Streaker',
  'Reach a 15-puzzle streak in one Survival mode run. A wrong move resets your streak. Earn 150 XP and 150 Academy Coins.',
  'boss', 'available', true, 150, '/student/training',
  'Academy', 'internal_puzzles', 'internal_survival_streak_reached', 'all_time', 15,
  false, true, false, 0
) on conflict (id) do nothing;
