# Gosciniec Uniejow — Sylwester game

Private promo game for the New Year Eve 2026/2027 offer of hotel Gosciniec Uniejow.

Player-facing text is Polish. All other artifacts use English (ASD-STE100).

This repository is private. There is no public licence.

## Run locally

You need Node 22.

```bash
npm install
npx playwright install chromium
npm run dev
```

Open the URL that Vite prints (default `http://127.0.0.1:5173`).

Useful commands:

- `npm test` — unit tests and coverage
- `npm run test:visual` — Playwright layout and contrast checks
- `npm run gallery` — screenshots in `docs/gallery/`
- `npm run build` — static files in `dist/` (GitHub Pages, relative base)
- `npm run build:kody` — the same build with base `/_assets/` for the Kody host
- `npm run precommit` — format, lint, typecheck, unit tests, CRAP

## Config

Tune gameplay in `src/config.ts`. The clock slow factor is `min(6, 1.5 ** streak)`.

Set optional public env values in `.env.local` (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BOOKING_URL`

Without Supabase keys, the app uses a local mock. Scores do not leave the browser.

## Backend

`src/backend/select.ts` picks the backend:

- No `VITE_SUPABASE_URL` or no `VITE_SUPABASE_ANON_KEY`: the local mock (`src/backend/mock.ts`).
- Both set: the Supabase adapter (`src/backend/supabase.ts`). It calls the SQL functions with plain `fetch`. There is no Supabase SDK.

Discount codes:

- One unique `SYL-XXXX` code per nickname, when the score reaches the limit. A repeat submit returns the same code.
- 10 %: 333 zł per person. Share bonus after 5 distinct referred players who finish a round: 299 zł per person.
- One code covers one whole booking and is redeemed once only.
- A code is valid until 31 December 2026, 23:59:59 Europe/Warsaw. Then its status is `expired`.

SQL functions (`supabase/migrations/`):

| Function          | Role              | Purpose                                          |
| ----------------- | ----------------- | ------------------------------------------------ |
| `issue_code`      | anon              | Store the score, count a referral, give the code |
| `leaderboard`     | anon              | Top scores: nickname and score only              |
| `check_code`      | service_role only | Nickname, discount, date earned, status          |
| `redeem_code`     | service_role only | Use the code once                                |
| `list_codes`      | service_role only | All codes, newest first                          |
| `dashboard_stats` | service_role only | Players, codes, share codes, redeemed            |
| `hide_nickname`   | service_role only | Remove a nickname from the leaderboard           |

All tables have Row Level Security on and no policies. Clients cannot read or change a table directly. Staff functions accept only the `service_role` key. The Kody fetch handler is the only process that uses that key. See `KODY.md`.

## Supabase setup (Tomasz)

1. Create a free Supabase project.
2. In **Project Settings → API**, copy the project URL and the `anon` public key. Put them in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, or in the host env.
3. Run the migrations: open **SQL Editor** and run each file in `supabase/migrations/` in name order. With the Supabase CLI you can use `supabase link` and then `supabase db push`.
4. Store the service role key as the Kody user secret `supabaseServiceRole`. Approve the host `csyrndeuldzbbkizmcav.supabase.co`. Do not put this key in the app, in `.env.local`, in the repository, or in a message.

The game uses only the anon key. Staff tools run after **Sign in with Kody** on the package app. See `KODY.md`.

## What Tomasz must provide

1. A Supabase project URL and the anon key (free tier is enough). See "Supabase setup".
2. The hotel website domain and the publish method (FTP, WordPress, or other).
3. The real booking page URL (the default is the public hotel email).
4. A yes to publish the Kody package app, and a yes to merge each pull request.

Do not put the Supabase service role key in the client or the repository. The Kody secret `supabaseServiceRole` already holds it.

## Process

GitHub issues plus the Sandcastle loop on the box. The loop opens pull requests. It does not merge. Do not use Cursor cloud agents.

PRD: `docs/PRD.md`.
