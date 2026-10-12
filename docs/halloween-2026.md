# Halloween Bot Hunt — 2026

Five opponents are available immediately in Computer: Pipkin Pumpkin (~400),
Boo the Ghost (~600), Count Checkula (~800), Mira Moonwitch (~1000), and
Grim the Werewolf (~1200). Strength settings interpolate the established bot
presets. These are estimates, not independently measured Elo ratings.

The quest is automatically active for every student from October 11 through
**November 1, 2026, 11:59 PM Asia/Bangkok**. The exclusive UTC deadline is
`2026-11-01T17:00:00Z`. Each distinct bot needs one saved win from the normal
starting position, with zero hints and zero takebacks. Repeated wins do not
increase the count. Results received by the server after the deadline do not
count. Bots remain playable after the quest ends; past completions remain visible.

On the fifth eligible win, the same transaction saves the completion and awards
500 XP. The existing XP-to-coins trigger awards 500 coins. The per-student lock
and stable completion ID prevent duplicate awards. Ordinary game rewards and
the normal bot ladder continue to work. Seasonal tracking cannot be changed
through generic browser quest-progress writes.

Computer play currently has no Hint control. It explicitly saves zero hints;
any future hint control must track its actual usage in `hintsUsed`. The server
validates and preserves nonzero counts and the reward query excludes them.

## Release

Apply `supabase/migrations/20261011054548_halloween_bot_quest.sql` before deploying
the application. The quest is seeded inactive and hidden so older application
versions cannot evaluate it through the ordinary quest flow. After verifying the
matching production commit is READY, activate the quest with:

```sql
update public.academy_quests set is_active=true,is_live=true
where id='halloween-2026-bot-quest';
```

Verify the progress RPC reports `enabled=true`. If rolling back to an application
version without this feature, disable both flags before rollback.
No cron job, activation button, imported games, or background polling is needed.
The existing quest-completion celebration shows the automatic reward.

## Verification

- `npm run lint`, `npm test -- --maxWorkers=2`, `npm run build`.
- `node scripts/test-halloween-quest.mjs`: isolated PostgreSQL, assistance,
  distinct wins, deadline boundaries, duplicate submissions, permissions,
  and transactional rollback using the existing wallet functions.
- `node tests/browser/halloween-server.cjs`, then
  `node tests/browser/verify-halloween.cjs`: production-build UI + authenticated
  API + isolated PostgreSQL. Real board moves, engine reply, takeback,
  resignation/save; complete-game fixtures exercise five wins and reward
  persistence. Desktop, tablet, and mobile screenshots are in `work/halloween`.
- Test database dependency: existing local `work/achievement-db-test` PGlite.
  Browser dependency: bundled Playwright + local Edge, or the respective
  `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` environment variables.

## Artwork

Built-in image generation produced five distinct transparent portraits using
`public/bots/pawny.png` as the rendering reference and Pipkin as a consistency
reference for the other four. Production exports are 480×480 WebP, about 190 KB
combined, in `public/bots/halloween/`. No external service is called to display them.
`scripts/prepare-halloween-bot-art.cjs` performs resizing/export only.

Shared prompt direction: young learners' chess opponents; glossy toy-like 3D,
big expressive eyes, warm gold and cyan rim light, smooth polished materials,
centered full-body square composition, readable at 64px, true transparent alpha,
no text, numbers, watermark, or scenery; festive and friendly rather than frightening.

Distinct subjects: orange jack-o-lantern pawn with green stem and ivory base;
pearl ghost knight with blue eyes and wisps; purple vampire bishop with a small
red-and-black cape; lavender witch queen with crescent hat; gray-brown friendly
werewolf king with a small crown. The generated illustrations were inspected
together before export and in the actual bot chooser on three viewport sizes.
