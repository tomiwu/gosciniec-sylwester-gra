# Rules for agents

These rules apply to every agent and every person that changes this repository.

## Process

1. Read `docs/PRD.md` and `docs/WORKFLOW.md` before you start.
2. Work only on a GitHub issue. Do only that issue.
3. Do not add the `Sandcastle` label. Tomasz validates issues first.
4. Do not take an issue with the label `hardware` or `needs-validation`.
5. Implement in the Sandcastle loop on the local machine with Claude Code. Never use Cursor cloud agents or other cloud agents.
6. Do not edit `docs/PRD.md`, `.sandcastle/`, `.claude/` or `.github/` from inside the loop. `.claude/settings.json` enforces this with `permissions.deny`; the Stop hook `.claude/hooks/stop-gate.sh` (loop only) makes the agent finish the commit, the Verification section and the fast checks.

## Code

- Follow the file in `standards/` for the project language.
- Use Red-Green-Refactor. Write a failing test first.
- Every unit has a CRAP score less than the project limit.
- Tests do not use the network. Use fakes and invented data.
- Do not weaken a test or extend a lint allow list to pass a check.
- No commented-out code. No TODO comments.

## Secrets and personal data

- Never put a secret, token, password, secret URL or personal data in code, tests, fixtures, logs, issues, PRs or commits.
- Use secret names only. Values live in environment variables or in `.sandcastle/.env` (not committed).
- Do not print secret values in logs.

## Commits and PRs

- One commit per loop phase. Message starts with `RALPH: #<issue>` (fixer: `RALPH: #<issue> fix`).
- The message says the task, the key decisions and the files changed.
- Branch name: `sandcastle/issue-<N>-<time>`.
- PR title = issue title. PR body ends with `Closes #<N>`.
- Squash-merge only when all CI checks pass.
