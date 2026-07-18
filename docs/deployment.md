# Deploying The Chess Academy Quest Board

This app is a Next.js App Router project deployed on Vercel with Supabase-backed production data.

## 1. Push To GitHub

From the project folder:

```bash
git status
git add .
git commit -m "Prepare app for Vercel deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

If the GitHub remote already exists, skip `git remote add origin ...` and run:

```bash
git push
```

Never commit `.env.local`. It is already gitignored.

## 2. Deploy On Vercel

1. Open Vercel and choose **Add New Project**.
2. Import the GitHub repository.
3. Framework preset should be **Next.js**.
4. Leave build command as `npm run build`.
5. Add the environment variables below before the first production deploy.
6. Click **Deploy**.

## 3. Environment Variables

Required for teacher/admin protection:

```bash
ADMIN_PASSWORD=replace_with_a_strong_teacher_password
ADMIN_SESSION_SECRET=replace_with_a_different_long_random_secret
CRON_SECRET=replace_with_a_long_random_cron_secret
```

Recommended app URL:

```bash
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
```

Supabase-ready values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace_with_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace_with_supabase_publishable_key_if_used
SUPABASE_SERVICE_ROLE_KEY=replace_with_server_only_service_role_key
PUZZLE_SESSION_SECRET=replace_with_a_long_random_puzzle_session_secret
```

OpenAI-ready value:

```bash
OPENAI_API_KEY=replace_with_server_only_openai_key
```

Lichess values used by the current app:

```bash
LICHESS_CLIENT_ID=your_lichess_client_id
LICHESS_CLIENT_SECRET=
LICHESS_REDIRECT_URI=https://your-vercel-domain.vercel.app/api/auth/lichess/callback
LICHESS_ENCRYPTION_SECRET=replace_with_32_byte_random_hex_secret
LICHESS_OAUTH_SCOPES=puzzle:read team:read
LICHESS_TEAM_ID=outschool-battleground
LICHESS_TOURNAMENT_CREATED_BY=
LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES=10
LICHESS_TEAM_TOURNAMENT_MAX=50
LICHESS_QUEST_TIMEZONE=America/Vancouver
```

The active Lichess student OAuth callback route is:

```text
https://your-vercel-domain.vercel.app/api/auth/lichess/callback
```

Use that exact path in Lichess. Do not use a localhost callback URL in Vercel. If `LICHESS_REDIRECT_URI` is omitted, the app builds the callback from `NEXT_PUBLIC_APP_URL`, so make sure `NEXT_PUBLIC_APP_URL` is your live Vercel URL.

Lichess puzzle sync needs `puzzle:read`. Team Arena/tournament reads use `team:read`. Blitz/rapid ratings and public game reads do not need extra OAuth scopes in this app.

Server-only secrets must not use the `NEXT_PUBLIC_` prefix. Keep these server-only:

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUZZLE_SESSION_SECRET`
- `OPENAI_API_KEY`
- `LICHESS_CLIENT_SECRET`
- `LICHESS_ENCRYPTION_SECRET`

## 4. Connect Supabase

1. Create a Supabase project and run the project migrations.
2. Add the public URL and anon/publishable key to Vercel.
3. Add `SUPABASE_SERVICE_ROLE_KEY` only in Vercel server environment variables.
4. Keep Row Level Security enabled for browser-accessible tables.
5. Keep service-role mutations inside server routes or server actions.

Student onboarding writes new rows to Supabase, so `SUPABASE_SERVICE_ROLE_KEY` must be configured in Vercel. Also run `docs/supabase-add-lichess-fields.sql` once so students can be linked by Lichess account.

Puzzle Training also needs the two `puzzle_training` migrations, `PUZZLE_SESSION_SECRET`, and an imported curated Lichess puzzle pool. Follow `docs/puzzle-training.md`; the importer runs locally and writes the curated rows to the configured Supabase project.

## 4.1 Vercel Cron Jobs

`vercel.json` schedules a protected daily Lichess team tournament sync:

```text
/api/cron/lichess-team-tournaments
```

Set `CRON_SECRET` in Vercel Production before deploying. Vercel sends it as a bearer token when invoking the cron route. The default schedule is once per day so it works on Hobby plans. On a Pro plan, you can increase freshness by changing the schedule in `vercel.json`, for example hourly:

```json
{ "path": "/api/cron/lichess-team-tournaments", "schedule": "0 * * * *" }
```

## 5. Test Public Student Pages

Public pages that should work without logging in:

- `/`
- `/app`
- `/app/leaderboard`
- `/app/badges`
- `/app/students/[slug]`
- `/app/classes`
- `/app/quests`

Use a student handle URL such as:

```bash
https://your-vercel-domain.vercel.app/app/students/so-pawny
```

Student public profiles should not require full names. Prefer first names, nicknames, or chess handles for parent/student privacy.

## 6. Test Admin Protection

Before logging in, these pages should redirect to `/admin-login`:

- `/admin`
- `/admin/students`
- `/admin/badges`
- `/admin/xp`
- `/admin/quests`
- `/admin/activity`

Then test:

1. Open `/admin-login`.
2. Choose **Teacher**.
3. Enter the `ADMIN_PASSWORD` value configured in Vercel.
4. Confirm `/admin` opens.
5. Open `/api/admin/debug-session` and confirm `adminCookieExists` and `verificationPassed` are both `true`.
6. Open `/admin/students` directly and confirm it stays accessible after login.
7. Click `/admin/badges`, `/admin/xp`, `/admin/quests`, and `/admin/activity`.
8. If login accepts the password but returns to `/admin-login`, clear cookies for the deployed domain, confirm `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set in Vercel Production, and redeploy.

## 7. Share Links

For parents who only need to view progress:

- Share the home page: `https://your-vercel-domain.vercel.app/`
- They can search by Lichess username from the home page.
- Or share a direct public student page: `https://your-vercel-domain.vercel.app/app/students/STUDENT_HANDLE`

For students:

- Share `/login` for Lichess login.
- Share `/student` after they have logged in once.

For the teacher:

- Use `/admin-login`.
- Do not share the teacher password in public class materials.

## 8. Final Local Checks

Run before pushing:

```bash
npm install
npm run lint
npm run build
```

Exact deployment command after GitHub is connected:

```bash
git add .
git commit -m "Prepare Vercel deployment"
git push
```

Vercel will build automatically after the push.
