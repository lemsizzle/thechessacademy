# Future Supabase Data Model

## profiles

- id uuid primary key
- auth_user_id uuid unique not null
- role text not null
- student_id uuid references students(id)
- display_name text
- created_at timestamptz default now()

## student_auth_accounts

- id uuid primary key
- student_id uuid references students(id)
- provider text not null
- provider_user_id text not null
- provider_username text not null
- created_at timestamptz default now()
- updated_at timestamptz default now()
- unique(provider, provider_user_id)

## students

- id uuid primary key
- slug text unique not null
- lichess_username text
- name text not null
- avatar_url text
- class_group text not null
- total_xp integer default 0
- is_active boolean default true
- onboarding_completed boolean default false
- encouragement text
- created_at timestamptz default now()
- updated_at timestamptz default now()
- source text
- outschool_learner_id text

## badges

- id text primary key
- name text not null
- description text not null
- category text not null
- tactic_theme text
- concept_theme text
- tier text
- xp_value integer not null
- unlock_requirement text not null
- required_puzzle_count integer
- visual_theme text not null
- image_prompt text
- art_image_url text
- final_image_url text
- generation_status text default 'pending'
- is_active boolean default true
- is_legacy boolean default false
- created_at timestamptz default now()

## student_badges

- id uuid primary key
- student_id uuid references students(id)
- badge_id text references badges(id)
- awarded_at timestamptz default now()
- awarded_by uuid

## xp_events

- id uuid primary key
- student_id uuid references students(id)
- amount integer not null
- reason text not null
- created_at timestamptz default now()
- created_by uuid

## student_tactic_progress

- id uuid primary key
- student_id uuid references students(id)
- tactic_theme text not null
- puzzles_solved integer default 0
- puzzle_solved_count integer default 0
- submitted_game_found_count integer default 0
- total_count integer default 0
- updated_at timestamptz default now()

## student_lichess_accounts

- id uuid primary key
- student_id uuid references students(id)
- lichess_user_id text
- lichess_username text not null
- lichess_profile_url text
- access_token_encrypted text
- scopes text[]
- blitz_rating integer
- blitz_games integer default 0
- blitz_rating_change integer
- blitz_rating_deviation integer
- blitz_provisional boolean default false
- rapid_rating integer
- rapid_games integer default 0
- rapid_rating_change integer
- rapid_rating_deviation integer
- rapid_provisional boolean default false
- puzzle_rating integer
- puzzle_games integer default 0
- peak_blitz_rating integer
- peak_rapid_rating integer
- peak_puzzle_rating integer
- baseline_blitz_games integer default 0
- baseline_rapid_games integer default 0
- baseline_puzzle_games integer default 0
- activity_baseline_set_at timestamptz
- linked_at timestamptz default now()
- last_rating_sync_at timestamptz
- last_puzzle_sync_at timestamptz
- last_game_sync_at timestamptz
- sync_status text not null
- revoked_at timestamptz
- created_at timestamptz default now()
- updated_at timestamptz default now()

## app_sessions

- id uuid primary key
- student_id uuid references students(id)
- role text not null
- created_at timestamptz default now()
- expires_at timestamptz not null

## game_review_submissions

- id uuid primary key
- student_id uuid references students(id)
- student_name text not null
- game_url text not null
- request_type text not null
- tactic_theme text
- move_number integer
- student_note text
- status text default 'pending_review'
- created_at timestamptz default now()
- reviewed_at timestamptz
- teacher_note text

## student_game_submissions

- id uuid primary key
- student_id uuid references students(id)
- game_url text not null
- platform text default 'lichess'
- lichess_game_id text
- played_as text default 'unknown'
- game_type text
- opponent_name text
- notes text
- status text default 'pending'
- submitted_at timestamptz default now()
- reviewed_at timestamptz
- reviewed_by uuid references profiles(id)
- teacher_note text
- rejection_reason text
- linked_analysis_request_id uuid references game_analysis_requests(id)

## student_score_submissions

- id uuid primary key
- student_id uuid references students(id)
- challenge_name text not null
- tactic_theme text
- score integer not null
- total_questions integer
- time_limit text
- platform text
- screenshot_url text
- notes text
- status text default 'pending'
- submitted_at timestamptz default now()
- reviewed_at timestamptz
- reviewed_by uuid references profiles(id)
- teacher_note text
- rejection_reason text
- xp_awarded integer default 0
- tactic_progress_added integer default 0

## game_analysis_requests

- id uuid primary key
- student_id uuid references students(id)
- lichess_game_id text not null
- lichess_url text not null
- student_color text not null
- status text not null
- requested_by uuid
- created_at timestamptz default now()
- completed_at timestamptz
- error_message text
- raw_game_data jsonb

## game_tactic_findings

- id uuid primary key
- analysis_request_id uuid references game_analysis_requests(id)
- student_id uuid references students(id)
- lichess_game_id text not null
- move_number integer not null
- move_san text
- move_uci text
- tactic_theme text not null
- confidence text not null
- detection_method text not null
- fen_before text
- fen_after text
- ai_explanation_teacher text
- ai_explanation_student text
- status text default 'pending_review'
- reviewed_at timestamptz
- reviewed_by uuid
- teacher_note text
- rejection_reason text
- created_at timestamptz default now()
- unique(student_id, lichess_game_id, move_number, tactic_theme)

## pending_awards

- id text primary key
- student_id uuid references students(id)
- source text not null
- tactic_theme text
- badge_id text references badges(id)
- badge_name text
- xp_value integer not null
- puzzles_solved integer
- status text default 'pending'
- created_at timestamptz default now()
- reviewed_at timestamptz

## lichess_sync_logs

- id uuid primary key
- student_id uuid references students(id)
- level text not null
- message text not null
- created_at timestamptz default now()

## quests

- id text primary key
- title text not null
- description text not null
- type text not null
- status text not null
- is_live boolean default false
- xp_reward integer not null
- badge_reward_id text references badges(id)
- class_group text
- category text
- source text
- condition_type text
- time_window text
- required_count integer
- required_score integer
- required_accuracy integer
- required_theme text
- approval_required boolean default true
- is_active boolean default true
- is_repeatable boolean default false
- cooldown_days integer default 0
- created_at timestamptz default now()
- updated_at timestamptz default now()

## student_quests

- id uuid primary key
- student_id uuid references students(id)
- quest_id text references quests(id)
- status text not null
- completed_at timestamptz

## activity_events

- id uuid primary key
- title text not null
- detail text not null
- actor_id uuid
- student_id uuid references students(id)
- created_at timestamptz default now()

## pending_quest_awards

- id text primary key
- student_id uuid references students(id)
- quest_id text references quests(id)
- source text
- source_period_start timestamptz
- source_period_end timestamptz
- title text
- description text
- xp_amount integer
- badge_id text references badges(id)
- evidence text
- status text default 'pending'
- created_at timestamptz default now()
- reviewed_at timestamptz
- reviewed_by uuid
- rejection_reason text

## quest_completion_events

- id text primary key
- student_id uuid references students(id)
- quest_id text references quests(id)
- award_id text references pending_quest_awards(id)
- completed_at timestamptz
- source text
- source_period_start timestamptz
- source_period_end timestamptz
- xp_awarded integer
- badge_awarded_id text references badges(id)
- evidence text

## lichess_activity_snapshots

- id text primary key
- student_id uuid references students(id)
- source text
- period_start timestamptz
- period_end timestamptz
- data jsonb
- mode text
- created_at timestamptz default now()

## badge_generation_jobs

- id uuid primary key
- badge_id uuid references badges(id)
- prompt text not null
- status text not null
- provider text default 'openai'
- selected_image_url text
- error_message text
- created_at timestamptz default now()
- completed_at timestamptz

## class_groups

- id text primary key
- name text not null
- outschool_class_url text
- outschool_section_id text
- sync_status text default 'not-connected'
- last_synced_at timestamptz
- created_at timestamptz default now()

## outschool_registration_events

- id uuid primary key
- class_group_id uuid references class_groups(id)
- learner_name text not null
- outschool_learner_id text
- raw_payload jsonb
- processed_at timestamptz
- created_at timestamptz default now()

## resources

- id text primary key
- title text not null
- description text not null
- url text not null
- category text not null
- status text default 'inactive'
- featured boolean default false
- class_group text
- created_at timestamptz default now()
- updated_at timestamptz default now()
- archived_at timestamptz

## lichess_arena_tournaments

- id uuid primary key
- lichess_id text unique
- team_id text nullable
- name text not null
- source text not null
- status text not null
- starts_at timestamptz
- ends_at timestamptz
- duration_minutes integer
- url text not null
- created_by text
- rated boolean
- variant text
- speed text
- time_control text
- player_count integer
- is_public boolean default true
- raw_data jsonb
- synced_at timestamptz
- imported_at timestamptz
- created_at timestamptz default now()
- updated_at timestamptz default now()

## lichess_arena_tournament_results

- id uuid primary key
- tournament_id uuid
- lichess_tournament_id text
- student_id uuid nullable
- lichess_username text
- rank integer
- score integer
- rating integer
- performance integer
- tournament_starts_at timestamptz
- raw_data jsonb
- imported_at timestamptz
- unique (lichess_tournament_id, lichess_username)

## pending_tournament_awards

- id text primary key
- student_id uuid
- tournament_id uuid
- lichess_tournament_id text
- lichess_username text
- title text
- description text
- xp_amount integer
- reason text
- tournament_source text
- status text
- teacher_note text
- created_at timestamptz
- reviewed_at timestamptz
- reviewed_by uuid
- rejection_reason text
- unique (student_id, lichess_tournament_id)

Old Swiss-related fields or tables are deprecated and unused. A migration should not drop them automatically.
