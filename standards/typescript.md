# TypeScript standards

Source: automations (`CODING_STANDARDS.md`, `.github/workflows/ci.yml`, workspace `package.json` files).

## Tools

- TypeScript strict mode, Node 22, ES modules. npm workspaces with one root `package-lock.json`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `isolatedModules`, `noEmit`.
- Tests: vitest. Coverage: `@vitest/coverage-v8` (json and text reporters).
- CRAP: `@sebassdc/crap4ts --fail-on-crap 6` (excludes `.test`, entry files, test fixtures). Limit: CRAP < 6.
- Each workspace has the scripts `typecheck` (`tsc --noEmit`), `test` (`vitest run`) and `crap`.

## CI jobs

| Job     | Command                                                            |
| ------- | ------------------------------------------------------------------ |
| build   | `npm ci`, `npm run typecheck`, `npm test`, `npm run crap`          |
| secrets | gitleaks on the full history, deny-list from the `DENYLIST` secret |

Note: automations has no separate format or lint job. The blueprint CI asks for `format` and `lint` jobs; add them when you use this standard.

Sandcastle `checks.json`: setup `npm ci --no-audit --no-fund`; checks `npm ci`, `npm run typecheck`, `npm test`, `npm run crap`.

## Code rules

- Every function has CRAP < 6. Keep functions small and tested.
- Tests do not use the network. Use fakes.
- No personal data anywhere. Fixtures use invented data (`Child One`, `Example School`).
- Secret values never appear in code, tests or the database. Use secret names only.
- No user-facing text in logic code. Put it in i18n catalogs.
- Do not add a dependency if Node 22 can do the task.
