# Student Login

Students log in through Lichess OAuth from `/login` with the Student tab selected.
The legacy `/student-login` route remains as a redirect so older bookmarks still work.

The app never asks for a Lichess password. Lichess handles the login screen, then redirects back to the app with an authorization result.

## Roles

Admin:
- Can open `/admin` and all teacher tools after the teacher login.
- Can edit students, badges, quests, resources, XP, and class data.
- Can approve or reject student submissions.

Student:
- Can open `/student` after student login.
- Can view only their own private dashboard, profile, and submission history.
- Can submit Lichess games and puzzle challenge scores for teacher review.
- Cannot edit XP, badges, quests, other students, or submission review fields.

## Login Flow

1. Student clicks `Log in with Lichess`.
2. The app starts a PKCE OAuth flow and stores state/verifier in httpOnly cookies.
3. Lichess redirects to `/api/auth/lichess/callback`.
4. The app verifies OAuth state and exchanges the code server-side.
5. The app fetches the Lichess account profile and ratings.
6. If the Lichess account is already linked, the student goes to `/student`.
7. If it is new, the student goes to `/student/onboarding`.

Default requested Lichess permissions are `puzzle:read` and `team:read`. Public game exports and public rating summaries do not have separate Lichess OAuth read scopes; the app reads them server-side by username/account after login.

## Mock Fallback

If `LICHESS_CLIENT_ID` is missing locally, `/api/auth/lichess/start` uses a clearly labeled mock Lichess login. This keeps local development working without asking students for passwords or fake credentials.

Mock login is not production authentication.

## Supabase Auth Upgrade

When Supabase Auth is connected:
- Replace the local storage session with Supabase session reads.
- Add a `profiles` table with `auth_user_id`, `role`, and optional `student_id`.
- Use Row Level Security so students can only read and insert rows tied to their own `student_id`.
- Keep admin/teacher mutations behind authenticated admin role checks.
- Store encrypted Lichess tokens in a server-side table, not browser localStorage.
