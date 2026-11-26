# Anti-cheat for the NYE prize board

The top 3 on the public leaderboard win a ticket, announced at midnight on NYE.
The client must not be the only source of the score.

## Server checks (reject)

These run in Postgres (`issue_round_score`), after `start_round` issues a round id, a token, and a seed:

- The round is known, unused, and belongs to this device and token.
- The wall time since `start_round` is at least 20 s (the honest game is about 25 s, minus 5 s slack) and at most 3 minutes.
- The score is at most 3210. That cap is `maxPossibleScore()` in `src/config.ts`: the fastest spawn interval is `600 / (1 + 1.25)` ms, so at most 158 items in 42 s, times 20 points (clock item), plus 50 slack.
- The compact summary (counts of glass, star, clock, and hits) is consistent with the score, and the total item count is at most 158.
- A non-zero score includes an input log of at most 16 384 bytes.
- A device may start 20 rounds per hour and 60 rounds per day.

The public leaderboard shows only `verified` scores. A legacy `issue_code` call still issues a discount code, but that row is not verified, so it does not appear on the prize board. Until Tomasz applies the SQL, the live game keeps using `issue_code` (the client falls back when `start_round` is missing).

## Replay (staff, TypeScript — not Postgres)

The game is deterministic from the server seed. The client records every touch, pointer, and key event, plus one step sample per animation frame (dt, direction, drag). Staff can replay the seed plus the step samples with `replayRound` in `src/game/replay.ts` and reject a mismatch. Postgres does not run the game loop. The staff panel `verify` action is the place to check the top 3 before a prize.

## Flags only (do not reject)

Human-likeness checks flag a score for staff review:

- too few events
- almost perfectly regular event intervals
- almost no touch-position spread
- first event faster than 80 ms
- log capped because it was too large

The input log lives in `public.round_logs`. Only staff RPCs can read it.
