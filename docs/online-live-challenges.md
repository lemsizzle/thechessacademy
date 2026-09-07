# Online student challenges

Students can send a timed, direct invitation from the shared “Online now” panel
in the Live Games lobby or Moves & challenges drawer. Existing correspondence
challenges remain independent. Both flows require explicit acceptance.

## Presence and privacy

- StudentPortalShell mounts one OnlinePlayProvider. While the app is visible it
  refreshes invitations every five seconds and sends a heartbeat every 30 seconds.
- Presence expires after 75 seconds without a heartbeat (including closed or
  backgrounded tabs). Multi-tab heartbeats share one student row.
- The server returns only active students' display names, IDs, and busy status;
  it omits the viewer and never returns their exact last-seen timestamps.
- Every API read/write uses requireActiveStudent. IDs identifying the sender or
  responding student are always taken from the verified cookie.
- The two new tables have RLS and no public/anonymous/authenticated grants or
  policies. Only server-side service-role operations can access them. Supabase's
  [RLS-without-policy informational notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  is intentional for these private tables. RPCs are SECURITY INVOKER and are
  executable only by service_role.

## Invitation rules

- Supported clocks: 3+2, 5+3, 7+2, 10 minutes, 10+5, 15+10. Colours are random.
- Invitations expire in two minutes. Only the recipient may accept/decline;
  only the sender may cancel. Sending an invitation creates no game.
- Checks reject self-challenges, inactive/offline recipients, duplicate pairs,
  and students already in an active live game. Accept rechecks availability.
- At most five pending/sent-per-minute invitations; 30-second same-recipient
  cooldown. Repeated accept calls return the same game, not another one.
- Pair operations lock student rows in ID order, then lock the invitation.
- Acceptance creates the normal live game atomically and starts its clock.
  The acceptor opens it immediately; the waiting sender opens it on the next
  refresh. Recent accepted invitations also offer an explicit Open game link.
- Notifications are in-app. System notification permission is not requested by
  this feature; existing correspondence notification preferences are unchanged.

## Verification

Run `npm test -- --maxWorkers=2`, `npm run lint`, and `npm run build`.
`scripts/verify-online-play.sql` exercises the real database functions under
service_role in a transaction, then rolls back all fictional students and games.
It covers all six clocks, idempotency, roles, duplicate invites, cancellation,
decline, expiry, offline/archived/busy checks, and denied public privileges.

For browser testing, run `node scripts/serve-online-play-harness.mjs` and open
`http://127.0.0.1:9418/?student=a` and `?student=b`. These render the production
provider/panel and correspondence drawer with in-memory fictional opponents.
Send an invitation, refresh the recipient drawer, decline, send again, and accept.
Both navigation readouts must show the same game. No production requests occur.
The fixture verifies UI wiring, not authentication; route tests verify the auth
boundary and the rollback SQL verifies persistence separately.
