# Puzzle auto-advance latency

The trainer now prepares one next board while the learner is solving the current
puzzle, in Survival and Woodpecker with auto-advance enabled. The completion
request validates that preparation and resets its server solve timer only after
the current attempt is saved. Answers remain in encrypted server-issued tokens.
Daily puzzles do not preload. This is one puzzle ahead, not a bulk download or
polling loop; leaving training or disabling auto-advance cancels preparation.

If preparation fails or is not ready, the existing completion-time selection and
normal loading fallback still work. Actual move validation and durable saving
still require a server round trip. This does not remove production network or
database latency.

## Browser verification (2026-09-23)

Used the actual trainer component, chess.js move validation, and mocked network
responses in `tests/browser/puzzle-auto-advance-harness.jsx`. No production data
was written. Puzzle GETs deliberately take 1,200 ms. Completion simulates a
550 ms cold selection/save path or 50 ms prepared save path.

| Scenario | Move to next board | Confirmation to next board |
| --- | ---: | ---: |
| Previous component from commit 8e3c009, Survival | 1,941 ms | 1,376 ms |
| Prepared Survival | 140 ms | 89 ms |
| Survival after incorrect move and retry | 143 ms | 79 ms |
| Prepared Woodpecker | 145 ms | 87 ms |

These are controlled fixture measurements, not measured production latency.
Also checked: an incorrect move stays on the current puzzle and loses one life;
disabling auto-advance while a response is held leaves the solved board and manual
Next Puzzle button; a failed background request recovers through normal loading.
Inspected the rendered board. Server tests separately cover token compatibility,
expiry, difficulty, exact puzzle matching, and awaited persistence before handoff.

Run the current fixture from the repository in PowerShell:

```powershell
$env:GAMEPLAY_FIXTURE='tests/browser/puzzle-auto-advance-harness.jsx'
$env:GAMEPLAY_PORT='9427'
node scripts/serve-gameplay-harness.mjs
```

Open `http://127.0.0.1:9427/`. Enable auto-advance and select Survival or
Woodpecker. The three example solutions are e5-c6, g2-c6, a4-d7. Use g2-h3
for an incorrect move. The visible test controls can hold/release move responses.
Add `?failPreload=1` to simulate failure of the first background puzzle request.
The baseline component was temporarily captured from Git for the comparison;
the maintained fixture uses only the current component.
