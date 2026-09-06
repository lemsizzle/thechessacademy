update public.badges b
set unlock_requirement = 'Score ' || r.required_puzzles || ' in one '
  || r.tactic_theme || '-only Survival round.'
from public.survival_tactical_badge_rules r
where r.badge_id = b.id;
