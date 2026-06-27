# The Chess Academy Quest Board App Plan

## Version 1 Scope

The first version is a local mock-data web app for tracking chess students, XP, levels, badges, quests, and activity.

Included:
- Public student portal pages.
- Student profile progress pages.
- Leaderboard with class group filtering.
- Badge gallery with collectible visual states.
- Quest board with weekly and boss quests.
- Useful links/resources board.
- Student-side Lichess connect and mock-ready puzzle sync.
- Mock teacher dashboard actions.
- Mock AI badge art generation workflow.

Not included yet:
- Payments.
- Student login.
- Parent accounts.
- Supabase connection.
- Real OpenAI image calls.
- Production-grade teacher/student authentication.

## Product Shape

The app is designed as an interactive class progress board, not a marketing website. The home page is intentionally short and sends users into either the student portal or teacher login.

## XP Levels

Levels use an RPG-style curve. Early levels are quick to earn so new students feel progress fast, while higher levels require larger XP jumps and feel more prestigious.

Current level thresholds:
- Level 1: 0 XP
- Level 2: 100 XP
- Level 3: 275 XP
- Level 4: 550 XP
- Level 5: 950 XP
- Level 6: 1500 XP
- Level 7: 2250 XP
- Level 8: 3250 XP
- Level 9: 4600 XP
- Level 10: 6400 XP

## Upgrade Path

1. Replace mock data imports with Supabase queries.
2. Move admin actions into server actions or route handlers.
3. Add proper teacher authentication.
4. Store generated badge art in Supabase Storage.
5. Add student and parent accounts only after the teacher workflow is stable.
