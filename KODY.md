# Kody package app

The game and the staff panel (`/panel/`) run as one Kody package app.
Supabase stores the scores and the discount codes.

## What the app does

- Player requests use the public Supabase URL and the anon key in the game
  bundle. The anon role may call only `issue_code` and `leaderboard`.
- Staff requests run only in the Kody fetch handler (`src/kody/entry.ts`).
  The handler calls `check_code`, `redeem_code`, `list_codes`,
  `dashboard_stats`, `hide_nickname`, and `leaderboard` with the user
  secret `supabaseServiceRole`. The placeholder in the source is
  `{{secret:supabaseServiceRole}}`. The live value must never be in the
  client, the repository, or a log.
- The approved host for that secret is `csyrndeuldzbbkizmcav.supabase.co`.
- Panel access is **Sign in with Kody** (`/-/auth/login`). The allow list
  is `STAFF.allowList` in `src/config.ts` (default: `tomiwu`). The handler
  checks the list again on every staff route.

## Build before you publish

```bash
npm run build:kody
```

This writes `dist/` with `base` `/_assets/`. The handler sends `/` to
`/_assets/index.html` and `/panel/` to `/_assets/panel/index.html`.

The GitHub Pages demo uses `npm run build` (`base` `./`). Do not mix the
two output folders.

## Publish

Do not publish until Tomasz says yes.

When he says yes:

1. Confirm the user secret `supabaseServiceRole` is set, and the host
   `csyrndeuldzbbkizmcav.supabase.co` is still approved.
2. Run `npm run build:kody`.
3. Confirm the built JS has no service-role value (search the `dist/`
   files).
4. Publish the package app from this repository (Kody CLI or the Kody
   site). Do not use `communityPublish` unless he asks for it.
5. Open the hosted URL, play a round, then open `/panel/`, sign in with
   Kody as `tomiwu`, and check a known code.

## Local panel without Kody

`npm run dev` serves `/panel/` with a mock Kody session. Add
`?kodyUser=tomiwu` to sign in as staff. Staff RPCs do not run on this
mock. They run only on the Kody host.
