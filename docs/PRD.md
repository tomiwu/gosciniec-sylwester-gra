# PRD: gosciniec-sylwester-gra

Status: DRAFT. Waiting for validation by Tomasz.

Language of this document: English, ASD-STE100. Player-facing game text is Polish.

## Problem

Hotel Gosciniec Uniejow needs a short, fun game that can drive New Year Eve 2026/2027 bookings. The hotel has a poster and a Facebook audience, but it has no interactive promo. The regular NYE offer is 370 zl per person, on 31 December 2026 at 20:00, with DJ Letsky.

## Goal

A player can open a web page on a phone, play one round of about 60 seconds, see the New Year Eve offer, and get a booking link. A player who reaches the score limit gets a unique 10 % discount code. A public top-20 list shows nicknames and scores. The game can go live on a hotel website subpage before the event.

## Users

- Guests who open a Facebook or Instagram link, or the hotel website, on a phone or a desktop browser.
- Hotel staff who check a discount code against a nickname and a score.

## Architecture

1. A static TypeScript + Vite + HTML5 canvas app. The build output is static files. A later step can copy the files to a hotel website subpage. There is no app install. This is not a Facebook Instant Game.
2. Game logic runs in the browser. A pluggable backend sends scores, codes and referrals. A local mock works without credentials. A Supabase adapter is used when Tomasz provides the project URL and the anon key.
3. Secrets never go into the repository. The anon key is a public client key and lives in a local `.env.local` or in the host env. Row Level Security must reject updates and deletes from anon. Discount codes are unique per nickname.

## Decisions (veto allowed)

1. Repository: private `tomiwu/gosciniec-sylwester-gra`. The project holds hotel promo data, so it is not public.
2. Language: TypeScript (strict) + Vite. Standards file: `standards/typescript.md`. CRAP limit: below 6.
3. Time slow-down: `slowFactor = min(maxFactor, minFactor * streakRatio ** streak)`. Default ratio 1.5, cap 6. This replaces the earlier "+1 s / +3 s" rule. All tunables live in `src/config.ts`.
4. A round has a 60 s game clock and a 90 s real-time cap, so a long streak stays fun and short.
5. Discount: 10 % per ticket when the score reaches 200 (tunable). Code form: `SYL-XXXX`, unique per nickname.
6. Referral (after the core game): a personal `?ref=CODE` link. When 5 distinct new players (device id + nickname) open the link and finish a round, the referrer code upgrades to 20 %. The end screen shows progress x/5.
7. Leaderboard: nickname only (max 16 characters), no email, top 20, score sanity check.
8. Look: night New York skyline behind a large art-deco gold clock, official gold logo, Didot typography and campaign couple silhouettes from the NYE posters, cream and gold on dark.
9. Sound is optional, with a mute control. Share uses the Web Share API, with a clipboard fallback.
10. The Sandcastle loop opens a PR and waits for CI. It does not merge. Tomasz must say yes before a merge or a publish. `AUTO_MERGE=0`.
11. The loop uses Claude Sonnet (`claude-sonnet-5-5`) to keep the token cost down.
12. Offer text defaults to the regular poster price: 370 zl per person. A 10 % game code lowers it to 333 zl / os. A share bonus after 5 referrals lowers it to 299 zl / os.
13. The booking URL defaults to the public hotel email until Tomasz gives the booking page.

## Requirements

Functional:

- F1 The player moves a dancing couple left and right (touch, mouse, or keyboard) and catches falling items: champagne glasses, stars, clock pieces. The player avoids obstacles.
- F2 One round uses a countdown clock to midnight of about 60 s of game time. Each catch streak raises the slow factor exponentially (`1.5 ** streak`, capped). Skilled play gives more time and more points. A real-time cap of 90 s ends the round.
- F3 An obstacle hit breaks the streak. The round does not end early, so every player sees the offer.
- F4 At midnight the game shows fireworks, a champagne decoration, the offer, and a "Zarezerwuj" booking link.
- F5 When the score reaches the limit, the player receives a unique discount code (10 %). The backend stores nickname, score and code.
- F6 The player can enter a nickname (max 16 characters), see a local best score, share the score, and see a top-20 list.
- F7 All player-facing text is Polish and lives in `src/i18n/pl.ts`.
- F8 A mute control turns sound off or on. Sound is off until the player turns it on, or the control is clearly available.
- F9 Referral: each player gets a personal link `?ref=CODE`. Five distinct new players (one count per device id + unique nickname) who finish a round upgrade the referrer from 10 % to 20 %. The end screen shows x/5. This is a later slice.
- F10 The start screen is simple and shows the hotel, the title, the price, a short how-to, "Graj" and "Zarezerwuj".

Non-functional:

- N1 Mobile-first portrait (about 390 x 844). The desktop layout also works (about 1280 x 800).
- N2 One round stays under 90 s of real time.
- N3 The static build has no required server, except the optional Supabase calls.
- N4 Playwright tests take screenshots at phone and desktop sizes, check overflow, check readable contrast, and check a gold-on-dark palette. A gallery is written to `docs/gallery/`.
- N5 Unit tests cover the clock formula, score sanity and the mock backend. Tests do not use the network.
- N6 Secrets are never in the repository or in logs.
- N7 Format, lint with warnings as errors, tests, coverage, and CRAP < 6. CI jobs: `format`, `lint`, `test`, `crap`, `secrets`.
- N8 The first load of the start screen should be fast on a mid-range phone. Keep the first document and scripts small. Compress large poster images when possible.

## Quality rules

- Language standard: `standards/typescript.md`.
- Format (Prettier 3), lint (ESLint 9, warnings as errors), tests (Vitest 4 and Playwright), coverage, CRAP < 6 (`@sebassdc/crap4ts` 0.1.1).
- Every merge to main needs a green CI. The loop must not merge. See `docs/WORKFLOW.md` and decision 10.
- Write code, comments and commit messages in English, ASD-STE100.

## Test decisions

- Unit tests (Vitest, Node, no browser) cover `slowFactor`, `tickRemaining`, `maxPossibleScore`, nickname checks and the mock backend.
- Playwright covers the start, play and end screens at 390 x 844 and 1280 x 800.
- Visual checks: no horizontal overflow, no key control outside the viewport, text contrast at least 4.5:1 against a solid background, gold accent near `#d4af37`, dark background.
- Tests use a fake backend. They never call a live Supabase project.
- A `npm run gallery` command writes review screenshots to `docs/gallery/`.

## Out of scope

- Facebook Instant Games, a native app, or an app store listing.
- Email collection, accounts, or a login.
- Payment in the game.
- Automated booking in the hotel system.
- A public repository or a public deploy, until Tomasz says yes.

## Success metrics

- A person can start a round in under 3 seconds of reading.
- A skilled player can reach the discount score in one round.
- Hotel staff can match a code to a nickname.
- The game can be copied as static files to a website subpage.

## Risks

- R1 No Supabase project yet. Fallback: pluggable backend with a local mock. The README lists the exact values Tomasz must provide.
- R2 The hotel domain and the publish method are unknown. Fallback: static `dist/` and a short publish note.
- R3 The booking URL is unknown. Fallback: `mailto:gosciniecuniejow@gmail.com` (public hotel address from the poster).
- R4 A client could fake a score. Mitigation: max score check, insert-only RLS, and a later server check if needed.
- R5 The box disk is low (about 15 GB free). Mitigation: reuse `node:22-bookworm`, do not install Playwright browsers in the Sandcastle image.
- R6 The default box `GH_TOKEN` is invalid. The loop start script unsets it and loads `.sandcastle/.env`.
- R7 Token budget is low. Mitigation: Sonnet, no Cursor cloud agents, lean research.

## Delivery

Issues are in GitHub. Issue #1 is the tracking issue. Because the live date is 26 November 2026, implementable slices get the `Sandcastle` label and a priority label at once, so the loop can start. Tomasz can veto a decision in this PRD. The loop opens pull requests and does not merge them.

Target: a playable build on 26 November 2026 (Europe/Warsaw). A later publish to the hotel site needs Tomasz's yes.

## Limits

- GitHub: the loop token needs Contents, Issues, Pull requests and Workflows, read/write. Administration helps for branch protection.
- Supabase: use the anon key in the client only, with RLS. Do not put the service role key in the app.
- Grok Bot and Claude: keep research short. The loop uses Sonnet.
- Disk on the box: keep the Podman image lean.

## Open questions (Tomasz)

1. Supabase project URL and anon key (masked). Recommended: one free project, run `supabase/schema.sql`.
2. Hotel website domain and publish method (FTP, WordPress, or other). Recommended: a subpage such as `/sylwester-gra`.
3. Booking page URL. Recommended: replace the mailto default in `src/config.ts`.
4. Confirm the offer price after 29 November 2026.
5. Yes to merge each PR, and later yes to publish.
