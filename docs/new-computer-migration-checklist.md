# New Computer Migration Checklist

Prepared on 2026-08-10. This repository is public on GitHub. Never use GitHub to transfer secrets, private student exports, browser storage, cookies, or generated authorization payloads.

## Before Leaving the Current Computer

- [ ] Keep the current checkout until the new computer has been verified.
- [ ] Review the working tree with `git status --short`.
- [ ] Review every intended file before staging it.
- [ ] Run `npm run lint`, `npm test`, and `npm run build` before committing application changes.
- [ ] Commit and push only after explicitly deciding which avatar artwork may be public.
- [ ] Transfer `.env.local` through a secure password manager or encrypted removable storage. Never add it to Git.
- [ ] Export any important `quest-board-admin-state-v1` browser data before retiring this browser.
- [ ] Confirm access to GitHub, Vercel, Supabase, and the Lichess OAuth configuration from the new computer.

## Recommended Commit Set

These repository files should be reviewed, then committed because they are code or durable project context:

- `AGENTS.md`
- `.gitignore`
- `docs/new-computer-migration-checklist.md`
- `components/student/AvatarStudio.tsx`
- `supabase/functions/avatar-storage-bootstrap/index.ts`
- `tsconfig.json`

The Avatar Studio change adds a featured shelf for catalog items that are both marked `isFeatured` and created during the previous fourteen days. Clicking an item uses the existing preview state and does not purchase or equip it. It uses existing `createdAt`, `isFeatured`, ownership, price, and renderer fields. It is focused and appears intentional. Run the normal checks before committing it.

The recovered Edge Function is an exact copy of live production version 3. It is intentionally disabled and returns HTTP 410. The connected production function has JWT verification enabled. Merely committing the source does not redeploy it.

`tsconfig.json` excludes `supabase/functions/**` from the Next.js TypeScript program because Supabase Edge Functions run on Deno and use Deno runtime globals. This keeps the web-app build separate without changing either runtime.

## Avatar Artwork Decision

The GitHub repository is public. The final layers are already publicly served from Supabase Storage, but raw generated/source artwork may have different provenance or redistribution concerns. Confirm ownership and public redistribution rights before committing any binary artwork.

### Final 1024x1024 layers worth preserving

These are the most important disaster-recovery assets. They should be committed if public redistribution is acceptable; otherwise copy them into a private encrypted archive:

- `work/avatar-assets/accessories/golden-knight-pet-v2.png`
- `work/avatar-assets/accessories/queen-earrings-gold.png`
- `work/avatar-assets/backgrounds/mathematicians-board.png`
- `work/avatar-assets/chess-accessories/bishop-buddy.png`
- `work/avatar-assets/clothing/formal-chess-blazer.png`
- `work/avatar-assets/clothing/hikaru-shirt-neck-fit.png`
- `work/avatar-assets/clothing/pineapple-hawaiian-shirt.png`
- `work/avatar-assets/clothing/queens-cape.png`
- `work/avatar-assets/eyes/googly-eyes.png`
- `work/avatar-assets/glasses/neon-pawn-shades.png`
- `work/avatar-assets/glasses/rook-eye-patch.png`
- `work/avatar-assets/hair/emo-hair.png`
- `work/avatar-assets/hair/tousled-brown-hair.png`
- `work/avatar-assets/headwear/black-bishop-cap.png`
- `work/avatar-assets/headwear/black-king-cap.png`
- `work/avatar-assets/headwear/cracked-eggshell.png`

All sixteen files are full-canvas `1024x1024` PNGs. The non-background layers have alpha. Supabase Storage currently contains equivalent production objects, although two names differ: the live Hikaru Shirt object uses the `pineapple-hawaiian-shirt.png` storage path, and the live Rook Eye Patch catalog row points to `rook-eye-patch-v3.png` while the matching local file is `rook-eye-patch.png`.

### Source inputs worth preserving privately or in Git

- `work/avatar-assets/accessories/golden-knight-pet-v2-chroma.png`
- `work/avatar-assets/accessories/queen-earrings-original.png`
- `work/avatar-assets/backgrounds/mathematicians-board.jpg`
- `work/avatar-assets/clothing/hikaru-shirt-original.png`
- `work/avatar-assets/clothing/pineapple-hawaiian-shirt-chroma.png`
- `work/avatar-assets/glasses/neon-pawn-shades-chroma.png`
- `work/avatar-assets/glasses/neon-pawn-shades-cutout.png`
- `work/avatar-assets/headwear/black-bishop-cap-chroma.png`
- `work/avatar-assets/headwear/black-king-cap-chroma.png`
- `work/avatar-assets/headwear/cracked-eggshell-chroma.png`
- `work/avatar-assets/headwear/Generated image 1.png`

These are source masters or intermediate cutouts used to recreate final layers. Because the repository is public, a private encrypted archive is the safer default until provenance is confirmed.

### Processing scripts worth preserving

Preserve every non-sensitive `.js` file under `work/avatar-assets/`. They document alpha removal, cropping, fixed-canvas placement, and avatar alignment. Several are not portable as written because they reference a temporary path or Downloads folder on the old computer. They remain useful recipes, but should eventually be updated to accept a relative input argument.

Scripts that currently use an old absolute or missing input path include:

- `work/avatar-assets/backgrounds/prepare-mathematicians-board.js`
- `work/avatar-assets/chess-accessories/prepare-bishop-buddy.js`
- `work/avatar-assets/clothing/prepare-formal-chess-blazer.js`
- `work/avatar-assets/clothing/prepare-queens-cape-v2.js`
- `work/avatar-assets/eyes/prepare-googly-eyes.js`
- `work/avatar-assets/glasses/prepare-rook-eye-patch.js`
- `work/avatar-assets/headwear/prepare-cracked-eggshell.js`
- `work/avatar-assets/prepare-pet-knight.js`
- `work/avatar-assets/prepare-queen-earrings.js`
- `work/avatar-assets/prepare-tousled-brown-hair.js`
- `work/avatar-assets/process-emo-hair.js`

The remaining processing scripts use an included source file or accept paths as command-line arguments.

### Leave ignored and do not commit

- `work/avatar-assets/avatar-studio-verification.png`: disposable UI verification screenshot.
- `work/avatar-assets/headwear/black-bishop-cap-preview.png`: generated preview.
- `work/avatar-assets/headwear/black-king-cap-preview.png`: generated preview.
- `work/avatar-assets/headwear/fix-cracked-eggshell.json`: generated request payload containing sensitive authorization material and embedded image data.
- `work/avatar-assets/headwear/fix-cracked-eggshell-payload.js`: generated payload builder containing sensitive authorization material.
- `work/*.log`: local development logs, already excluded by `*.log`.

The two cracked-eggshell payload files should not be copied to the new computer unless they are placed in an encrypted security archive for incident review. Their authorization value should be considered exposed locally and rotated if it still protects anything. Do not print it or place it in a commit.

## Exact Manual-Copy List

Copy these outside Git using secure storage:

1. `C:\Users\momin\Documents\Chess Academy web app\.env.local`
2. The eleven source-input artwork files listed above if they are not committed after a rights review.
3. The sixteen final avatar layers listed above if they are not committed.
4. Any important processing scripts not committed.
5. An export of the browser-local `quest-board-admin-state-v1` value if it contains class, resource, tournament, award, or analysis records that must be retained.
6. Any external original images still located in Downloads or Windows temporary clipboard paths and referenced by the non-portable scripts, if those original files still exist.

Do not manually copy browser cookies or OAuth tokens. Log in again on the new computer.

## Browser-Only Data

The application uses these browser storage keys:

- `quest-board-admin-state-v1` in localStorage: may contain students, badges, quests, class groups, XP events, resources, manual/imported tournaments, Arena results, pending tournament awards, tournament XP/activity, quest progress/attempts/awards/completions, Lichess snapshots/connections/logs, tactic progress, submissions, game-analysis requests/findings, and local log messages.
- `quest-board-admin` in localStorage: legacy UI marker only; it is not real admin authentication.
- `quest-board-student-session` and `quest-board-student-session-user` in localStorage: legacy student fallback identity. Durable student identity remains in Supabase and the real login uses HTTP-only cookies.
- `quest-board-parent-profile-access` in sessionStorage: one-hour parent lookup grant; intentionally disposable.
- `quest-board-auto-lichess-sync:<studentId>` in sessionStorage: short synchronization cooldown; intentionally disposable.

Supabase-backed students, badges, XP events, quest attempts/progress, submissions, Lichess snapshots, avatars, inventory, wallets, and coin transactions survive a computer move. Browser-only class/resource edits, manual tournament records/results/awards, game-analysis queues, or unsynchronized fallback records do not. These local records affect only the browser that created them; they are not a reliable shared production data source, but they may still matter to the teacher as records.

## Files to Recreate Rather Than Copy

- `.vercel/project.json`: run `npx vercel link` on the new computer and select the existing `thechessacademy` project. Do not commit `.vercel/`.
- `node_modules/`: recreate with `npm install`.
- `.next/`, TypeScript build info, and logs: recreate by running the development server or build.
- Git credentials, Vercel CLI login, Supabase connector login, and Codex connectors: authenticate again.
- Admin and student cookies: log in again.
- The local Vercel OIDC token: let Vercel tooling issue a new one; do not transfer it casually.

## New Computer Setup

- [ ] Clone `https://github.com/lemsizzle/thechessacademy.git`.
- [ ] Open and read `AGENTS.md`.
- [ ] Run `npm install`.
- [ ] Securely restore `.env.local` or recreate it from the Vercel, Supabase, and Lichess settings.
- [ ] Run `npx vercel link` and choose the existing `thechessacademy` project.
- [ ] Reconnect GitHub, Vercel, Supabase, and Codex tooling.
- [ ] Restore any private avatar source archive outside the public repository.
- [ ] Run `npm run lint`, `npm test`, and `npm run build`.
- [ ] Run `npm run dev` and verify admin login, Lichess login/callback, onboarding, student dashboard, rewards, quests, avatar loading, and submissions.
- [ ] Confirm Supabase data and Storage assets appear before deleting the old checkout.

## Remaining Risks

- The public repository may be inappropriate for raw avatar source art until licensing and provenance are confirmed.
- Some asset scripts depend on original files in old temporary/Downloads paths that may already be gone.
- Browser-only teacher data has no automatic migration and may be the only copy of local class/resource/tournament/analysis work.
- Production environment variables live in Vercel, not Git, and access must be retained through the Vercel account/team.
- Supabase production data and Storage are remote and survive the computer move, but project access and service credentials must be recoverable.
- The recovered Edge Function source is uncommitted until the eventual migration commit is made.
