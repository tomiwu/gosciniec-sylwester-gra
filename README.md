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
- `npm run build` — static files in `dist/`
- `npm run precommit` — format, lint, typecheck, unit tests, CRAP

## Config

Tune gameplay in `src/config.ts`. The clock slow factor is `min(6, 1.5 ** streak)`.

Set optional public env values in `.env.local` (see `.env.example`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BOOKING_URL`

Without Supabase keys, the app uses a local mock. Scores do not leave the browser.

## What Tomasz must provide

1. A Supabase project URL and the anon key (free tier is enough). Then run `supabase/schema.sql` in the SQL editor.
2. The hotel website domain and the publish method (FTP, WordPress, or other).
3. The real booking page URL (the default is the public hotel email).
4. A yes to merge each pull request, and a later yes to publish the game.

Do not send the Supabase service role key. The app must not use it.

## Process

GitHub issues plus the Sandcastle loop on the box. The loop opens pull requests. It does not merge. Do not use Cursor cloud agents.

PRD: `docs/PRD.md`.
