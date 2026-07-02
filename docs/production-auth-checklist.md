# Production Auth Checklist

Use this checklist for Vercel Production environment variables.

## Required Variables

| Name | Example value | Public or private | Used by |
| --- | --- | --- | --- |
| `ADMIN_PASSWORD` | `a-long-teacher-password` | Private | `/api/admin/login`, `/api/admin/session`, `/admin` route protection |
| `ADMIN_SESSION_SECRET` | `a-different-long-random-secret` | Private | Stable admin session cookie signing across Vercel functions |
| `NEXT_PUBLIC_APP_URL` | `https://your-vercel-domain.vercel.app` | Public | Lichess callback URL building, logout redirects |
| `LICHESS_CLIENT_ID` | `the-chess-academy-quest-board` | Private server env | Lichess OAuth authorization and token exchange |
| `LICHESS_REDIRECT_URI` | `https://your-vercel-domain.vercel.app/api/auth/lichess/callback` | Private server env | Lichess OAuth authorization and token exchange |
| `LICHESS_ENCRYPTION_SECRET` | `replace_with_32_byte_random_hex_secret` | Private | Encrypting stored Lichess access tokens in cookies/mock storage |
| `LICHESS_OAUTH_SCOPES` | `puzzle:read team:read` | Private server env | Lichess OAuth authorization screen |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Public | Public Supabase reads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Public | Public Supabase reads |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Private | Student onboarding profile creation |

## Optional Variables

| Name | Example value | Public or private | Used by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `your-publishable-key` | Public | Future Supabase client option |
| `OPENAI_API_KEY` | `sk-...` | Private | Future AI badge generation |
| `LICHESS_CLIENT_SECRET` | empty for public PKCE apps | Private | Optional Lichess confidential-client token exchange |
| `LICHESS_TEAM_ID` | `outschool-battleground` | Private server env | Lichess team tournament sync |
| `LICHESS_TOURNAMENT_CREATED_BY` | `your-lichess-username` | Private server env | Tournament filtering/metadata |
| `LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES` | `10` | Private server env | Tournament sync cache timing |
| `LICHESS_TEAM_TOURNAMENT_MAX` | `50` | Private server env | Tournament sync limit |
| `LICHESS_QUEST_TIMEZONE` | `America/Vancouver` | Private server env | Lichess quest windows |

## Lichess Sync Cooldown

Run this optional Supabase migration once for production sync stability:

```text
docs/supabase-lichess-sync-migration.sql
```

It adds `lichess_sync_state`, which lets Vercel remember the last successful sync, last rate-limit error, request count, and next allowed sync time. Without it, the app still works, but cooldowns are less reliable across serverless requests.

Teacher-only safe debug route:

```text
/api/admin/lichess/debug?studentId=STUDENT_UUID
```

This reports whether required environment variables exist and whether that student is cooling down. It does not return secret values.

## Exact Lichess Callback URL

The app's real student Lichess OAuth callback route is:

```text
https://your-vercel-domain.vercel.app/api/auth/lichess/callback
```

If you use a custom domain, replace the domain only:

```text
https://your-custom-domain.com/api/auth/lichess/callback
```

Do not use:

```text
http://localhost:3000/api/auth/lichess/callback
```

for Vercel production.

## Admin Cookie Requirements

The admin login route sets this server-readable cookie:

```text
quest_board_admin_session
```

It is set with:

- `httpOnly: true`
- `secure: true` in production
- `sameSite: "lax"`
- `path: "/"`
- a 7-day max age

The `/admin` layout performs the real server-side signature validation with `ADMIN_SESSION_SECRET`, falling back to `ADMIN_PASSWORD` if no separate secret is set. Admin auth is intentionally not checked in edge middleware/proxy, because the server layout is more reliable for cookie validation on Vercel navigation requests.

## Debug Admin Session

After logging in as admin, open:

```text
/api/admin/debug-session
```

It should show:

```json
{
  "adminCookieExists": true,
  "verificationPassed": true,
  "adminPasswordExists": true,
  "adminSessionSecretExists": true
}
```

It never returns secret values.

## Clear Cookies And Retest

If you changed `ADMIN_SESSION_SECRET` or `ADMIN_PASSWORD`, clear the old browser cookie before testing:

1. Open the deployed site in the browser.
2. Open browser developer tools.
3. Go to Application or Storage.
4. Clear cookies for the Vercel/custom domain.
5. Reload `/admin-login`.
6. Log in again.

You can also test in a private/incognito window.

## Quick Production Test

1. Add or update all required variables in Vercel Production.
2. Redeploy the latest commit.
3. Open `/admin-login`.
4. Log in as Teacher.
5. Open `/api/admin/debug-session` and confirm the admin cookie exists and verification passed.
6. Open `/admin/students` directly in the address bar.
7. Click admin sidebar links: Students, Badges, Quests, XP, Activity.
8. Open `/login?mode=student`.
9. Click **Log in with Lichess**.
10. Confirm Lichess shows the live domain and callback uses `/api/auth/lichess/callback`.

## Student Onboarding After Deleting A Student

If you delete a student row from Supabase, the next Lichess login for that same account should go back to onboarding. The app checks Supabase after every Lichess login and ignores stale browser cookies if the Supabase student row no longer exists.

Run this migration once if your `students` table does not have Lichess identity columns yet:

```text
docs/supabase-add-lichess-fields.sql
```

Then test:

1. Delete the student row in Supabase.
2. Clear cookies for the deployed domain or use a private/incognito window.
3. Log in with Lichess.
4. Confirm the app opens `/student/onboarding`.
5. Complete profile setup.
6. Confirm a new `students` row exists with `lichess_id` and `lichess_username`.
7. Open `/api/student/debug-session` and confirm `studentExistsByLichess` is `true`.
