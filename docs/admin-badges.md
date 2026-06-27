# Admin Badges

Custom badges created from the teacher dashboard are saved in the Supabase `badges` table.

## How It Works

- Public pages read badges with the public Supabase key.
- If public reads fail or the table is empty, the app can still fall back to mock badge data.
- Admin create, edit, and delete actions use protected server routes under `/api/admin/badges`.
- Those server routes use `SUPABASE_SERVICE_ROLE_KEY`, which is why the key must stay server-side only.

## Required Vercel Environment Variables

Add these in Vercel Project Settings:

```txt
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_teacher_password
ADMIN_SESSION_SECRET=your_stable_admin_session_secret
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code or with a `NEXT_PUBLIC_` prefix.

## Badge Fields

The app maps frontend camelCase fields to Supabase snake_case fields:

- `xpValue` -> `xp_value`
- `unlockRequirement` -> `unlock_requirement`
- `visualTheme` -> `visual_theme`
- `artImageUrl` -> `art_image_url`
- `finalImageUrl` -> `final_image_url`
- `generationStatus` -> `generation_status`
- `generationError` -> `generation_error`

The current Supabase schema stores badge tiers as `C`, `B`, `A`, and `S`. The app displays those as `Bronze`, `Silver`, `Gold`, and `Platinum`. Concept badges are stored with tier `C` only because the existing database column is required, but the app hides the tier for concepts.

## Testing On Vercel

1. Deploy the latest code to Vercel.
2. Log in as teacher.
3. Open `/admin/badges`.
4. Create a badge.
5. Save changes.
6. Open Supabase Table Editor and check the `badges` table.
7. Open `/app/badges` and confirm the badge appears publicly.

## Badge Art Generation

The badge editor uses a protected server route:

```txt
POST /api/admin/badges/generate-art
```

By default, this returns mock badge art options so the workflow is safe and testable without an OpenAI key.

To enable live OpenAI image generation later, add:

```txt
OPENAI_API_KEY=your_server_side_openai_key
OPENAI_BADGE_IMAGE_MODE=openai
OPENAI_IMAGE_MODEL=gpt-image-1
```

`OPENAI_API_KEY` must stay server-side. Do not add `NEXT_PUBLIC_` to it.

## Delete Behavior

Deleting a badge removes it from the `badges` table. If students have earned that badge, the existing database foreign key cascade may also remove related `student_badges` rows. The app shows a warning before deleting.

## Note About AI Prompts

The current Supabase schema does not include an `image_prompt` column. Badge art URLs and generation status are saved, but edited prompt text remains local until a future migration adds a prompt column.
