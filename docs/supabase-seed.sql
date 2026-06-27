-- The Chess Academy Quest Board
-- Sample seed data for a fresh Supabase project.
--
-- Run docs/supabase-schema.sql first, then run this file.
-- The fixed UUIDs make this seed safe to rerun.

-- Sample students. Use first names, nicknames, or chess handles for privacy.
insert into public.students (
  id,
  display_name,
  public_slug,
  avatar_url,
  class_group,
  total_xp,
  level,
  is_active
) values
  ('00000000-0000-4000-8000-000000000001', 'Arina', 'arina', null, 'Class 1', 420, 4, true),
  ('00000000-0000-4000-8000-000000000002', 'So Pawny', 'so-pawny', null, 'Class 1', 760, 5, true),
  ('00000000-0000-4000-8000-000000000003', 'Firedrangan525', 'firedrangan525', null, 'Class 2', 310, 3, true),
  ('00000000-0000-4000-8000-000000000004', 'Puzzle Knight', 'puzzle-knight', null, 'Wednesday Dragons', 980, 6, true),
  ('00000000-0000-4000-8000-000000000005', 'Endgame Mage', 'endgame-mage', null, 'Dragons', 150, 2, true)
on conflict (id) do update set
  display_name = excluded.display_name,
  public_slug = excluded.public_slug,
  avatar_url = excluded.avatar_url,
  class_group = excluded.class_group,
  total_xp = excluded.total_xp,
  level = excluded.level,
  is_active = excluded.is_active;

-- Starting badge set.
insert into public.badges (
  id,
  name,
  description,
  category,
  tier,
  xp_value,
  unlock_requirement,
  visual_theme,
  generation_status
) values
  ('10000000-0000-4000-8000-000000000001', 'Fork Apprentice', 'Spot beginner forks where one piece attacks two targets at once.', 'Tactics', 'C', 25, 'Solve 10 fork puzzles.', 'bronze-green glow, knight fork, two target sparks', 'not_generated'),
  ('10000000-0000-4000-8000-000000000002', 'Fork Master', 'Use advanced forks to win material or force checkmate threats.', 'Tactics', 'A', 100, 'Solve 50 fork puzzles.', 'gold-purple aura, powerful knight fork, magical board lines', 'not_generated'),
  ('10000000-0000-4000-8000-000000000003', 'Discovered Attack', 'Move one piece away to reveal a hidden attack from another piece.', 'Tactics', 'B', 50, 'Solve 20 discovered attack puzzles.', 'silver-blue glow, opened diagonal, hidden bishop beam', 'not_generated'),
  ('10000000-0000-4000-8000-000000000004', 'Deflection', 'Force a defender away from the square or piece it must protect.', 'Tactics', 'B', 50, 'Solve 20 deflection puzzles.', 'blue magic pull, shield breaking, target square', 'not_generated'),
  ('10000000-0000-4000-8000-000000000005', 'Back Rank Mate', 'Recognize checkmates against a trapped king on the back rank.', 'Checkmates', 'C', 35, 'Complete 10 back rank mate puzzles.', 'bronze rook line, trapped king, glowing back rank', 'not_generated'),
  ('10000000-0000-4000-8000-000000000006', 'Two Bishop Checkmate', 'Coordinate both bishops to control diagonals and finish the king.', 'Checkmates', 'A', 120, 'Demonstrate the two bishop checkmate pattern.', 'gold bishops crossing beams, royal academy sigil', 'not_generated'),
  ('10000000-0000-4000-8000-000000000007', 'Pawn Promotion', 'Guide a pawn to the final rank and turn it into a stronger piece.', 'Endgames', 'C', 30, 'Promote a pawn in a game or endgame challenge.', 'green-bronze pawn becoming queen, rising magic', 'not_generated'),
  ('10000000-0000-4000-8000-000000000008', 'Underpromotion Legend', 'Choose a knight, bishop, or rook promotion when queen is not best.', 'Creativity', 'S', 200, 'Find or play a correct underpromotion.', 'radiant legendary aura, pawn splitting into rare pieces', 'not_generated'),
  ('10000000-0000-4000-8000-000000000009', 'Comeback King', 'Stay calm and turn a worse position into a win or draw.', 'Sportsmanship', 'B', 60, 'Recover from a losing position in class or tournament play.', 'blue crown comeback aura, cracked board repairing', 'not_generated'),
  ('10000000-0000-4000-8000-000000000010', 'Hand and Brain Hero', 'Communicate clearly with a teammate in hand-and-brain chess.', 'Sportsmanship', 'C', 30, 'Win or complete a hand-and-brain challenge.', 'teamwork hands, glowing king and knight emblem', 'not_generated'),
  ('10000000-0000-4000-8000-000000000011', 'Opening Principles', 'Develop pieces, fight for the center, and castle safely.', 'Openings', 'C', 25, 'Show opening principles in three games.', 'academy scroll, center squares glowing, castled king', 'not_generated'),
  ('10000000-0000-4000-8000-000000000012', 'Endgame Survivor', 'Use king activity and careful pawn play to survive endgames.', 'Endgames', 'B', 70, 'Hold or win a difficult endgame.', 'silver-blue king and pawn, moonlit endgame board', 'not_generated'),
  ('10000000-0000-4000-8000-000000000013', 'Calm Under Pressure', 'Make thoughtful moves even when the clock or position feels tense.', 'Sportsmanship', 'B', 60, 'Show calm decision-making in a pressured game.', 'blue calm aura, clock, focused king emblem', 'not_generated'),
  ('10000000-0000-4000-8000-000000000014', 'Puzzle Streak', 'Build a habit of solving tactics consistently over time.', 'Tactics', 'A', 110, 'Complete a 7-day puzzle streak.', 'gold puzzle flame, streak counter sparks, academy badge', 'not_generated'),
  ('10000000-0000-4000-8000-000000000015', 'Tournament Warrior', 'Play bravely and complete an academy tournament event.', 'Tournament', 'A', 125, 'Complete a tournament with strong effort.', 'gold tournament banner, crossed chess pieces, arena glow', 'not_generated')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  tier = excluded.tier,
  xp_value = excluded.xp_value,
  unlock_requirement = excluded.unlock_requirement,
  visual_theme = excluded.visual_theme,
  generation_status = excluded.generation_status;

-- XP history.
insert into public.xp_events (id, student_id, amount, reason, created_at) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 50, 'Solved a tactics mini-quest.', now() - interval '9 days'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 75, 'Won a class practice game.', now() - interval '5 days'),
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 100, 'Completed opening principles quest.', now() - interval '8 days'),
  ('20000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 125, 'Tournament effort award.', now() - interval '3 days'),
  ('20000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 60, 'Great puzzle challenge score.', now() - interval '4 days'),
  ('20000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004', 110, 'Puzzle streak completed.', now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000005', 30, 'Promoted a pawn in an endgame.', now() - interval '1 day')
on conflict (id) do update set
  student_id = excluded.student_id,
  amount = excluded.amount,
  reason = excluded.reason,
  created_at = excluded.created_at;

-- Earned badges.
insert into public.student_badges (id, student_id, badge_id, awarded_at, note) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', now() - interval '7 days', 'First fork badge earned.'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000011', now() - interval '8 days', 'Used opening principles consistently.'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000015', now() - interval '3 days', 'Finished tournament with strong effort.'),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', now() - interval '4 days', 'Recognized back rank mate pattern.'),
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000014', now() - interval '2 days', 'Completed puzzle streak.'),
  ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000007', now() - interval '1 day', 'Promoted a pawn correctly.')
on conflict (student_id, badge_id) do update set
  awarded_at = excluded.awarded_at,
  note = excluded.note;

-- Starter quests.
insert into public.quests (
  id,
  title,
  description,
  quest_type,
  xp_reward,
  badge_reward_id,
  is_active,
  starts_at,
  ends_at
) values
  ('40000000-0000-4000-8000-000000000001', 'Weekly Tactics Sprint', 'Solve 10 tactics puzzles this week.', 'weekly', 100, '10000000-0000-4000-8000-000000000014', true, now() - interval '1 day', now() + interval '6 days'),
  ('40000000-0000-4000-8000-000000000002', 'Opening Academy', 'Play three games while following opening principles.', 'weekly', 75, '10000000-0000-4000-8000-000000000011', true, now() - interval '2 days', now() + interval '5 days'),
  ('40000000-0000-4000-8000-000000000003', 'Endgame Trial', 'Win or hold a king-and-pawn endgame challenge.', 'boss', 120, '10000000-0000-4000-8000-000000000012', true, null, null),
  ('40000000-0000-4000-8000-000000000004', 'Tournament Prep', 'Join an academy Arena and finish all rounds you can play.', 'tournament', 125, '10000000-0000-4000-8000-000000000015', true, now(), now() + interval '14 days'),
  ('40000000-0000-4000-8000-000000000005', 'Sportsmanship Star', 'Show focus, respect, and resilience in class games.', 'weekly', 60, '10000000-0000-4000-8000-000000000013', true, now() - interval '1 day', now() + interval '6 days')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  quest_type = excluded.quest_type,
  xp_reward = excluded.xp_reward,
  badge_reward_id = excluded.badge_reward_id,
  is_active = excluded.is_active,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at;

-- Student quest progress.
insert into public.student_quests (id, student_id, quest_id, status, completed_at, created_at) values
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'in_progress', null, now() - interval '1 day'),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'completed', now() - interval '8 days', now() - interval '9 days'),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000005', 'in_progress', null, now() - interval '2 days'),
  ('50000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'completed', now() - interval '2 days', now() - interval '8 days'),
  ('50000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000003', 'not_started', null, now() - interval '1 day')
on conflict (student_id, quest_id) do update set
  status = excluded.status,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at;

-- Activity feed.
insert into public.activity_events (id, student_id, event_type, title, description, created_at) values
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'badge_awarded', 'Fork Apprentice earned', 'Arina earned the Fork Apprentice badge.', now() - interval '7 days'),
  ('60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'quest_completed', 'Opening Academy complete', 'So Pawny completed the Opening Academy quest.', now() - interval '8 days'),
  ('60000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'badge_awarded', 'Tournament Warrior earned', 'So Pawny earned the Tournament Warrior badge.', now() - interval '3 days'),
  ('60000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'xp_awarded', 'Puzzle challenge XP', 'Firedrangan525 earned XP from a puzzle challenge.', now() - interval '4 days'),
  ('60000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', 'quest_completed', 'Puzzle streak complete', 'Puzzle Knight completed the Weekly Tactics Sprint.', now() - interval '2 days'),
  ('60000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000005', 'badge_awarded', 'Pawn Promotion earned', 'Endgame Mage earned the Pawn Promotion badge.', now() - interval '1 day')
on conflict (id) do update set
  student_id = excluded.student_id,
  event_type = excluded.event_type,
  title = excluded.title,
  description = excluded.description,
  created_at = excluded.created_at;
