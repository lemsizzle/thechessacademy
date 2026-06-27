# Deploying The Chess Academy Quest Board

This app is ready to deploy as a Next.js App Router project on Vercel. The current version uses mock/local browser storage for editable classroom data, with the code structured for Supabase later.

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

Server-only secrets must not use the `NEXT_PUBLIC_` prefix. Keep these server-only:

- `ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `LICHESS_CLIENT_SECRET`
- `LICHESS_ENCRYPTION_SECRET`

## 4. Connect Supabase Later

The app currently renders and edits mock data locally. To make classroom edits persistent across devices:

1. Create a Supabase project.
2. Add the public URL and anon/publishable key to Vercel.
3. Add `SUPABASE_SERVICE_ROLE_KEY` only in Vercel server environment variables.
4. Create tables from `docs/data-model.md`.
5. Add Row Level Security before exposing student-specific data.
6. Move local admin mutations from browser storage into server routes or server actions.
7. Move generated badge images into Supabase Storage.

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
5. Open `/admin/students` directly and confirm it stays accessible after login.

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
