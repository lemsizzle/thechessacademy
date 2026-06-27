# Production Auth Checklist

Use this checklist for Vercel Production environment variables.

## Required Variables

| Name | Example value | Public or private | Used by |
| --- | --- | --- | --- |
| `ADMIN_PASSWORD` | `a-long-teacher-password` | Private | `/api/admin/login`, `/api/admin/session`, `/admin` route protection |
| `NEXT_PUBLIC_APP_URL` | `https://your-vercel-domain.vercel.app` | Public | Lichess callback URL building, logout redirects |
| `LICHESS_CLIENT_ID` | `the-chess-academy-quest-board` | Private server env | Lichess OAuth authorization and token exchange |
| `LICHESS_REDIRECT_URI` | `https://your-vercel-domain.vercel.app/api/auth/lichess/callback` | Private server env | Lichess OAuth authorization and token exchange |
| `LICHESS_ENCRYPTION_SECRET` | `replace_with_32_byte_random_hex_secret` | Private | Encrypting stored Lichess access tokens in cookies/mock storage |
| `LICHESS_OAUTH_SCOPES` | `puzzle:read team:read` | Private server env | Lichess OAuth authorization screen |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Public | Public Supabase reads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Public | Public Supabase reads |

## Optional Variables

| Name | Example value | Public or private | Used by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `your-publishable-key` | Public | Future Supabase client option |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Private | Future server-side admin writes |
| `OPENAI_API_KEY` | `sk-...` | Private | Future AI badge generation |
| `LICHESS_CLIENT_SECRET` | empty for public PKCE apps | Private | Optional Lichess confidential-client token exchange |
| `LICHESS_TEAM_ID` | `outschool-battleground` | Private server env | Lichess team tournament sync |
| `LICHESS_TOURNAMENT_CREATED_BY` | `your-lichess-username` | Private server env | Tournament filtering/metadata |
| `LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES` | `10` | Private server env | Tournament sync cache timing |
| `LICHESS_TEAM_TOURNAMENT_MAX` | `50` | Private server env | Tournament sync limit |
| `LICHESS_QUEST_TIMEZONE` | `America/Vancouver` | Private server env | Lichess quest windows |

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

The `/admin` layout and `proxy.ts` both check the same cookie.

## Quick Production Test

1. Add or update all required variables in Vercel Production.
2. Redeploy the latest commit.
3. Open `/admin-login`.
4. Log in as Teacher.
5. Open `/admin/students` directly in the address bar.
6. Open `/login?mode=student`.
7. Click **Log in with Lichess**.
8. Confirm Lichess shows the live domain and callback uses `/api/auth/lichess/callback`.
