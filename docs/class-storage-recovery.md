# Teacher storage recovery

The teacher cache previously accumulated raw Lichess activity snapshots with no
readers. It could exceed localStorage's quota and stop class settings from saving.

## Rollout

- Apply `20260923014136_durable_class_settings.sql` before deploying the app.
  It was applied to the existing production project on September 23, 2026.
- On the first teacher visit, archive the saved browser JSON and current in-memory
  state in IndexedDB (`chessquest-admin-recovery`, `backups`, `original-v1`).
  Archive completion must precede removing raw activity snapshots. Other local
  fields are retained. Failed backup leaves the original cache untouched.
- Import local class settings and actual roster class names into the server.
  Archive each distinct original class list in `academy_class_import_backups`.
  Later browsers archive their lists without overwriting established server data.
- Teacher class editing uses an authenticated server endpoint and transactional
  revision checks. Renames update roster assignments; removing a class changes
  its students to Unassigned. Conflicts retain the draft for review.
- Public class lists omit private Outschool section IDs. Direct database access
  is restricted to the service role; browsers use the server routes.

The schema deployment alone does not migrate browser data. The application must
be deployed and opened in the browser holding the existing settings. Do not clear
site data beforehand. Resources and other legacy local-only edits still require
the browser backup; only class settings move to server storage in this change.

## Recovery

The teacher warning and Classes page provide **Download browser backup**. The JSON
includes current local state and the original archive. Treat it as private student
data, keep it outside Git, and do not share it publicly. If storage is disabled,
enable storage for the site, then use **Retry backup and cleanup**. A failed class
import with invalid older fields remains editable on Classes. Correct the fields
and save. Use **Reload Classes** to resolve a conflicting save deliberately.

## Verification

- Unit coverage: backup failure/retry, edits during backup, prevention of new raw
  snapshot caching, class validation/merge, authorization, same-origin writes,
  revision conflict responses and preservation of original import data.
- `scripts/verify-class-settings.mjs` exercises the real SQL in isolated PGlite:
  import idempotency, backups, rename swaps, removal assignments, stale revisions,
  validation and database permissions. It uses the existing optional test runtime
  under `work/achievement-db-test/node_modules`; install `@electric-sql/pglite`
  in that isolated directory before running it on a fresh checkout.
- `tests/browser/class-settings-harness.jsx` uses actual React components,
  localStorage and IndexedDB with fake class endpoints. Run it with
  `GAMEPLAY_FIXTURE=tests/browser/class-settings-harness.jsx` and
  `GAMEPLAY_PORT=9425` through `scripts/serve-gameplay-harness.mjs`.
  A 3,000,000-character snapshot was backed up and the remaining cache was 241
  characters. Saving, reloading, stale-save draft retention and explicit reload
  were exercised in the browser. This is test data, not a measurement of the
  owner's production browser.
