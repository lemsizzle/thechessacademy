# Student Submissions

Student submissions are review-first. A student can submit work, but XP, badge progress, and tactic progress are not awarded until the teacher approves it.

## Game Submissions

Students submit Lichess game URLs from `/student/submit`.

The app:
- Validates the URL as a Lichess game link.
- Saves a `pending` submission.
- Does not analyze the game automatically.
- Shows the student that the game was submitted for teacher review.

Teachers review games at `/admin/submissions/games`.

Teacher options:
- Approve only.
- Reject.
- Mark needs changes.
- Open the game URL.
- Send the game to the Game Analyzer.

## Puzzle Score Submissions

Students submit challenge scores from `/student/submit`.

The old `/student/submit-game` and `/student/submit-score` links redirect to the unified submit page.

Teachers review scores at `/admin/submissions/scores`.

When approving, the teacher can choose:
- XP to award.
- Tactic progress points to add.

The approval flow updates mock student XP and tactic progress, then checks for pending tactic badge awards.

## Privacy Notes

Students only see their own submission history in `/student/submissions`.

Public student profiles stay clean and do not show private submission history, teacher notes, rejection reasons, or admin controls.

In Supabase, protect these tables with Row Level Security:
- Students can insert their own submissions.
- Students can read their own submissions.
- Students cannot update status, review fields, XP awards, or progress awards.
- Admins can read and manage all submissions.
