-- Include Survival mistakes in the private adaptive-review queue.

alter table public.adaptive_review_items
  add column if not exists source_kind text not null default 'game',
  add column if not exists source_puzzle_id uuid references public.chess_puzzles(id) on delete cascade;

alter table public.adaptive_review_items
  alter column source_game_id drop not null;

alter table public.adaptive_review_items
  drop constraint if exists adaptive_review_source_kind_valid,
  drop constraint if exists adaptive_review_source_valid;

alter table public.adaptive_review_items
  add constraint adaptive_review_source_kind_valid
    check (source_kind in ('game', 'survival')),
  add constraint adaptive_review_source_valid
    check (
      (source_kind = 'game' and source_game_id is not null and source_puzzle_id is null)
      or
      (source_kind = 'survival' and source_game_id is null and source_puzzle_id is not null)
    );

alter table public.adaptive_review_items
  drop constraint if exists adaptive_review_items_student_source_puzzle_ply_key;

alter table public.adaptive_review_items
  add constraint adaptive_review_items_student_source_puzzle_ply_key
    unique (student_id, source_puzzle_id, source_ply);

create index if not exists adaptive_review_items_source_puzzle_idx
  on public.adaptive_review_items(source_puzzle_id);

comment on column public.adaptive_review_items.source_kind is
  'Server-owned origin of the review position: an analyzed game or a Survival puzzle.';
comment on table public.adaptive_review_items is
  'Private game and Survival mistake positions scheduled for each student with spaced repetition.';
