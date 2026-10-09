# Student What's new

The button in `StudentNavigation` is available throughout the authenticated student shell. It opens a text-only native dialog with the newest student updates first. Close, Escape, and a backdrop click dismiss it; focus returns to the button. The list scrolls independently on small screens.

`lib/student/whatsNew.ts` is the editorial source. Add a uniquely identified entry when releasing a student feature, badge, quest, or avatar item, including catalog additions made through the teacher tools. Use the date students could first use it, rather than migration, import, or later artwork-edit timestamps. Group related items to keep the list readable; omit teacher-only work, hidden content, and unreleased promises. The initial list was checked against main's August–October 2026 history and active live catalog records on October 9.

The popup filters a rolling **two calendar months**, inclusive of the boundary day, using the academy's Bangkok date. Shorter month ends are clamped, future entries are hidden, and the window is recalculated each time the popup opens. An empty state appears when nothing remains in that window. Same-day entries keep their editorial order.

The dialog and content are loaded only when opened. There is no database/API read, polling, extra storage, or automatic gameplay interruption. Future notes need to be added to the source when changes ship; the list does not infer releases from database changes.

Verification: `npx vitest run tests/student/whats-new.test.tsx`, TypeScript checks, and production build. For the browser flow, start `node tests/browser/displayed-badge-server.cjs` after building, then run `node scripts/verify-student-whats-new.cjs` (set `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if needed). It checks desktop/tablet/mobile opening, scrolling, Close/Escape/backdrop, focus restoration, and use from a gameplay page with isolated synthetic data.
