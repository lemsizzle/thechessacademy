# AI Badge Generation

The current app includes a mock-ready badge art workflow in the admin badge page.

Rules implemented in the app design:
- Badge images are never generated during normal page load.
- Generation only starts when the teacher clicks Generate Badge Art or Regenerate Badge Art.
- If a badge already has an image, the UI can reuse it.
- The prompt builder is reusable: `buildBadgeImagePrompt(badge)`.
- Badge prompts can be edited per badge in the admin badge editor.
- If no custom prompt is saved, the app uses the generated default prompt from the badge details.
- API keys must stay server-side only.
- Generated files should later be stored in Supabase Storage.

## Future Server Flow

1. Admin clicks Generate Badge Art.
2. Client calls the protected server route `POST /api/admin/badges/generate-art`.
3. Server checks teacher authentication.
4. Server builds the prompt with `buildBadgeImagePrompt`.
5. Server returns mock art by default, or calls OpenAI image generation when `OPENAI_BADGE_IMAGE_MODE=openai`.
6. Server uploads generated images to Supabase Storage.
7. Server writes a `badge_generation_jobs` record.
8. Admin selects the preferred option.
9. Server saves `badges.final_image_url`.

The current implementation has the protected route and mock fallback in place. Supabase Storage upload and job records are still future work.

## Prompt Guidance

Badge art should be circular or emblem-like, use a glowing border, show a clean centered chess/fantasy icon, and avoid text inside the image. Badge names, XP, tiers, and requirements should be displayed by the app UI.

The active tactic badge system uses Bronze, Silver, Gold, and Platinum tiers. Do not use the old C/B/A/S language for active tactic badge prompts.

Tier style guidance:
- Bronze: bronze glow, beginner magical emblem
- Silver: silver glow, polished magical emblem
- Gold: gold glow, heroic magical emblem
- Platinum: platinum radiant glow, legendary boss-level emblem

Tactic badge prompts should include the tactic name, tier, unlock requirement, chess tactic symbolism, collectible circular badge design, magical chess academy theme, and a clean centered emblem/icon composition with no text inside the image.

Concept badge prompts should include the concept name, unlock requirement, chess concept symbolism, collectible circular badge design, magical chess academy theme, and a clean centered emblem/icon composition with no text inside the image. Concept badges do not use tier language.
