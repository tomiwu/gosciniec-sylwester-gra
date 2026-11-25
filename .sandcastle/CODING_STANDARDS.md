# Coding standards for the Sandcastle agents

The reviewer agent loads this file. Keep it short. Put the full rules in `standards/typescript.md`.

- Language: TypeScript (strict, Node 22, Vite, ES modules). Full rules: `standards/typescript.md`.
- CRAP limit: every unit has a CRAP score less than 6.
- Write all code, comments and commit messages in English, ASD-STE100.
- Player-facing strings are Polish and live only in `src/i18n/pl.ts`.
- All gameplay tunables live in `src/config.ts`.
- Tests do not use the network. Use the mock backend.
- No secrets and no personal data. Fixtures use invented data only (`Anna`, `PlayerOne`).
- Do not add a dependency if Node 22 or the current tools can do the task.
- Do not merge to main. The host loop has `AUTO_MERGE=0`.
