# ADR 0001: Stack and process

## Status

Accepted, veto allowed.

## Context

The game must be ready on 26 November 2026. It must run in a phone browser from a link. Tomasz is low on tokens. The box disk is low.

## Decision

- Use TypeScript, Vite and a canvas, with no game engine.
- Keep all tunables in `src/config.ts`.
- Use Vitest for unit tests and Playwright for visual tests.
- Use the project-blueprint process: private GitHub repo, issues, Sandcastle on the box, no Cursor cloud agents.
- Set `AUTO_MERGE=0`. The loop must not squash-merge.
- Use Claude Sonnet for the loop.

## Consequences

Hosting is a static folder. Visual tests need Chromium in CI, not in the Sandcastle image. PRs wait for Tomasz before they land on main.
