# Kody package app

The public game and the staff page `/panel/` run as one Kody package app
(kody.codes). Package: `@tomiwu/gosciniec-sylwester-gra` (leaf
`gosciniec-sylwester-gra`). This document has no secret values.

Do not publish the app and do not merge to `main` until Tomasz says yes.

## Routes

| Route                           | Access              | What it does                         |
| ------------------------------- | ------------------- | ------------------------------------ |
| `/`                             | public, no login    | Redirect to the built game           |
| `/_assets/*`                    | public              | Static files from `dist/`            |
| `/panel/`                       | Kody session, staff | Staff page (no session: go to login) |
| `POST /api/staff/check`         | Kody session, staff | `check_code(p_code)`                 |
| `POST /api/staff/redeem`        | Kody session, staff | `redeem_code(p_code, p_note)`        |
| `GET /api/staff/codes`          | Kody session, staff | `list_codes(p_limit, p_offset)`      |
| `GET /api/staff/stats`          | Kody session, staff | `dashboard_stats()`                  |
| `POST /api/staff/hide-nickname` | Kody session, staff | `hide_nickname(p_nickname)`          |

- Login and logout use the platform routes `/-/auth/login` and
  `/-/auth/logout` (Sign in with Kody).
- No session on `/api/staff/*`: `401`. A user who is not on the allow list:
  `403`. In both cases the handler does not call Supabase.
- A `POST` with an `Origin` header from another site gets `403`.

## Files

- `package.json#kody.app`: `entry` is `./src/kody/entry.ts`, `assets` is
  `./dist`.
- `src/kody/entry.ts`: default-exports the fetch handler. It uses
  `createPackageAppAuth` and `auth.resolveUser(request)`.
- `src/kody/handler.ts`: routes, session check, allow list, input checks.
- `src/kody/supabase.ts`: staff RPC calls with the placeholder
  `{{secret:supabaseServiceRole}}` in the `apikey` and `Authorization`
  headers of the outbound `fetch`. Kody puts in the value only for the
  approved host.
- `src/kody/config.ts`: package name, staff allow list, Supabase URL.

## What Tomasz must do

1. Create the Supabase project. Run the schema and the migrations.
2. Send the project URL and the anon key. Both are public values.
   - The game reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build
     time (`.env.local`, not committed).
   - Set the same URL in `KODY_APP.supabaseUrl` in `src/kody/config.ts`.
     While it is empty, staff routes answer `503` and do not call Supabase.
3. Store the Supabase service role as a Kody account secret with the name
   `supabaseServiceRole`. Do not send the value in chat, in an issue, or in a
   commit.
4. Approve the Supabase host (`<project-ref>.supabase.co`) for that secret.
   Approve the package when Kody asks.
5. The staff RPCs must accept the `service_role` (grant `execute` to
   `service_role`). The handler does the staff check, because a service-role
   call has no `auth.uid()`.

## Staff allow list

`KODY_APP.staffAllowList` in `src/kody/config.ts` lists the Kody usernames
that may use `/panel/` and `/api/staff/*`. The default is `tomiwu`. The match
ignores letter case.

To add reception staff later:

1. Add the Kody username to `staffAllowList` (pull request).
2. If the app is not public, also grant Use on the app: `inviteCreate` with
   `kind: "grant"` and `resource_type: "app"`. A Use grant alone does not
   open `/panel/`; the allow list is necessary.

## Try it with `kody dev`

```bash
npm ci
npm run build:kody   # writes dist/ with base /_assets/
kody dev
```

Open `/` (the game, no login) and `/panel/` (Sign in with Kody, then the
staff page). Without `KODY_APP.supabaseUrl` the staff API answers `503`.

## Publish (only after Tomasz says yes)

1. Make sure the secret `supabaseServiceRole` exists and its host is
   approved.
2. Run `npm run build:kody`.
3. Search `dist/` for a service-role value. There must be none.
4. Publish the package app. Do not use `communityPublish` unless Tomasz asks.
5. Open the hosted URL. Play a round. Open `/panel/`, sign in as `tomiwu`, and
   check a known code.
