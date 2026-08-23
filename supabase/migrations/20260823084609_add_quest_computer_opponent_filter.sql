alter table public.academy_quests
  add column if not exists required_opponent_id text;

comment on column public.academy_quests.required_opponent_id is
  'Optional stable bot identifier used to restrict Academy computer-game quests to one opponent.';

update public.academy_quests
set source = 'internal_games',
    condition_type = 'internal_computer_games_won_count',
    required_count = 2,
    required_opponent_id = 'knight',
    completion_url = '/student/play',
    updated_at = now()
where lower(title) = 'beat the knight';
