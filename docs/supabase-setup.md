# Supabase Setup For The Chess Academy Quest Board

This guide creates the real database structure for the app. It does **not** connect the app to Supabase yet. The app will keep working with mock data until the code is updated to read and write Supabase data.

## 1. Open Supabase

1. Go to [supabase.com](https://supabase.com).
2. Log in.
3. Create a new project, or open the project you want to use for The Chess Academy Quest Board.

## 2. Go To SQL Editor

1. In your Supabase project, open **SQL Editor** from the left sidebar.
2. Click **New query**.

## 3. Run `supabase-schema.sql`

1. Open `docs/supabase-schema.sql` in this project.
2. Copy the full file.
3. Paste it into the Supabase SQL Editor.
4. Click **Run**.

This creates:

- students
- badges
- student_badges
- xp_events
- quests
- student_quests
- activity_events
- badge_generation_jobs
- indexes
- updated_at triggers
- Row Level Security policies

## 4. Run `supabase-seed.sql`

1. Open `docs/supabase-seed.sql`.
2. Copy the full file.
3. Paste it into a new Supabase SQL Editor query.
4. Click **Run**.

This adds sample students, badges, XP events, quests, and activity events so you can inspect the database immediately.

## 5. Check Table Editor

1. Open **Table Editor** in Supabase.
2. Click each table and confirm rows exist:
   - `students`
   - `badges`
   - `student_badges`
   - `xp_events`
   - `quests`
   - `student_quests`
   - `activity_events`
3. Open `badge_generation_jobs` and confirm it exists. It may be empty, and that is fine.

## 6. Add Environment Variables To Vercel

In Vercel, open:

**Project -> Settings -> Environment Variables**

Add these public Supabase values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

If your Supabase project uses the newer publishable key name, add this too:

```bash
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Add this server-only value:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Keep your existing app secrets too:

```bash
ADMIN_PASSWORD=your_teacher_password
OPENAI_API_KEY=your_openai_key_if_using_ai_badge_generation
```

## 7. Redeploy Vercel

After adding environment variables:

1. Open your Vercel project.
2. Go to **Deployments**.
3. Click the latest deployment menu.
4. Choose **Redeploy**.

The current app still uses mock data, so adding these variables will not change the app by itself. They prepare the project for the next step: connecting the app code to Supabase.

## 8. Test Public App Pages

Open these pages without logging in:

```text
/
/app
/app/leaderboard
/app/badges
/app/students/arina
/app/classes
/app/quests
```

These should remain public.

Privacy reminder: student public profiles should not require full names. Use first names, nicknames, or chess handles.

## 9. Test Admin Pages

Open:

```text
/admin
```

You should be redirected to:

```text
/admin-login
```

Log in using `ADMIN_PASSWORD`, then test:

```text
/admin/students
/admin/badges
/admin/xp
/admin/quests
/admin/activity
```

## 10. What Not To Expose Publicly

Never put these in client-side code, public pages, screenshots, or GitHub:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ADMIN_PASSWORD`
- `LICHESS_ENCRYPTION_SECRET`
- `LICHESS_CLIENT_SECRET`

Only variables starting with `NEXT_PUBLIC_` are meant to be visible in the browser.

## 11. Add Lichess Identity Fields

Student Lichess login and onboarding need two columns on `students`:

- `lichess_id`
- `lichess_username`

If your project was created before these columns existed, run:

```text
docs/supabase-add-lichess-fields.sql
```

This migration is safe to run after your original schema. It does not delete data.

When an admin deletes a student, future Lichess login for that same account is treated as a missing profile and the student can complete onboarding again.

## What Happens Next

The database is ready after you run the schema and seed files. The app is still mock-data-first. The next development step is to replace local mock reads/writes with Supabase calls gradually:

1. Read public students, badges, quests, and activity from Supabase.
2. Move admin create/edit/delete actions to server-side routes.
3. Store badge art in Supabase Storage.
4. Keep admin writes behind server-side checks and the service role key.
