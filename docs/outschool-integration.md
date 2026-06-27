# Outschool Integration Plan

The app now supports an Outschool-ready mock flow:

- Each class group can store an Outschool class URL.
- The public Classes page can show an Outschool class link per group.
- The admin Students page includes a mock registration import.
- A placeholder server route exists at `/api/outschool/sync`.

## Current MVP Behavior

The app does not depend on a real Outschool API yet. The admin can paste the Outschool class page URL for each group and use Mock Import Registration to create a local student in that group.

## Future Real Sync Options

Use whichever access Outschool supports for your account:

1. Official API, if Outschool grants one.
2. Exported roster CSV, parsed by an admin upload/import screen.
3. Email notification parsing through a separate mailbox automation.
4. Zapier or Make webhook, if Outschool enrollment events can trigger one.

Avoid scraping teacher pages behind login. It is brittle and can expose private learner data in unsafe ways.

## Server Route

`/api/outschool/sync` currently accepts:

```json
{
  "classGroup": "Saturday Knights",
  "learnerName": "Student Name",
  "outschoolLearnerId": "optional-id"
}
```

Later this route should verify a shared secret, validate the payload, upsert the student, and record an `outschool_registration_events` row.
