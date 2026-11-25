# Workflow

This is the process of crap4s, automations and e1003-calendar.

## 1. PRD first

- Write `docs/PRD.md` from `docs/PRD-template.md`.
- Tomasz reads and validates the PRD. Until then, the status line is `DRAFT`.

## 2. GitHub issues

- Run `scripts/create-labels.sh owner/repo` once.
- Issue #1 is the tracking issue (template `tracking`). It links the PRD.
- Each other issue is one vertical slice (template `slice`) or one spike (template `spike`).
- Each issue has: Goal, Scope, Acceptance criteria, a `priority: ...` label and, when necessary, `Blocked by #N`.
- Put CI gates first (format, lint, test, CRAP). Then the slices.
- All issues start with the label `needs-validation`.
- Issues that need a real device get the label `hardware`. The loop never takes them.

## 3. Validation

- Tomasz validates the issues.
- Only after his validation: remove `needs-validation` and add `Sandcastle` to the issues that are ready.
- Do not add `Sandcastle` before validation. Do not add it to `hardware` issues or to the tracking issue.

## 4. Sandcastle loop

- The loop runs on the local machine (the box), in Podman, with Claude Code as the agent.
- Never use Cursor cloud agents or other cloud agents for implementation.
- Order: highest `priority: ...` first, then the lowest issue number. An issue with an open `Blocked by #N` waits.
- Each iteration: implementer -> reviewer -> local checks (`.sandcastle/checks.json`) -> fixer (max 3 attempts) -> push -> PR -> CI -> squash-merge -> close issue.
- If CI fails, the CI fixer gets the failed job log and tries again.
- The loop stops when no issue is ready, or when an issue cannot pass. It writes a comment on that issue.
- Start: `scripts/start-loop.sh <project> <repo-dir>`. Log: `/workspace/<project>-loopN.log`. Each project has its own lock, PID file and log names, so loops of different projects do not mix.
- Dry run: `DRY_RUN=1 npm run sandcastle` prints the next issue and runs no agent.
- Issues that must change `.github/` can fail when the token has no Workflows permission. Skip them with `SKIP_ISSUES=12,14` and do them by hand.

### 4a. Loop rules (tomiwu, 2026-11-13)

From the review of the Lydia Hallie talk on Claude Code loops. The template files have them; keep them in a new project.

1. **Limit-reset-aware wall-clock wait.** The Claude message gives the reset time (`You've hit your 5-hour limit · resets 6:30pm (UTC)`). The loop parses it (`.sandcastle/loop-policy.mts`) and waits until then on the wall clock (`Date.now()` polling). A fixed `setTimeout` freezes while the box is suspended. On a Claude limit, do not try the other Claude models: they share the same subscription limit.
2. **Stop hook with exit 2** (`.claude/hooks/stop-gate.sh`). Exit 1 ends the task; exit 2 makes the same session continue, with its context. The hook checks: a commit exists (implementer), the tree is clean, a `## Verification` section exists, and `.claude/hooks/fast-checks.sh` passes. It is active only with `LOOP_STOP_GATE=1` (the loop sets it), so interactive sessions are not affected. `stop_hook_active` allows one forced retry; the host checks and the fixer catch the rest.
3. **`idleTimeoutSeconds: 1800`** for every agent run. The Sandcastle default (600 s) stops long builds.
4. **Early host check** after the implementer, before the reviewer (`earlyHostCheck` in `.sandcastle/checks.json`), for a build that the sandbox image cannot run (for example a cross-compile). A failure goes to the fixer at once, not at the end of the merge gate.
5. **`permissions.deny`** in the committed `.claude/settings.json` (push, PR create/merge, issue close, `gh api`, `.env`, `docs/PRD.md`, `.sandcastle/`, `.claude/`, `.github/`). It works with `--dangerously-skip-permissions` (tested with Claude Code 2.1.322). It is a guard rail, not a sandbox: a rule matches a command prefix. Cursor CLI fallbacks do not read it, so the prompt keeps one short line with the same prohibitions.
6. **Short prompts.** Only facts that the code does not show. Name the PRD sections, do not ask to read the full PRD. Each prohibition once. Inline issue at most 15 KB; the full issue is in `.sandcastle/context/issue.json`. Long prompts make the results worse.
7. **Reviewer** checks the acceptance criteria of the issue first (`met` / `not met` with evidence), then lists bugs, then simplifies. `REVIEW_MODEL` selects its model.
8. **Verification** in the commit and the PR: the command and the pasted tail of its real output; before/after numbers for a performance issue. Without it the PR body gets a visible "Missing" note.
9. **Effort per phase** (`EFFORT_IMPLEMENTER`, `EFFORT_REVIEWER`, `EFFORT_FIXER`, `EFFORT_FIXER_FORMAT`). A fixer for a format/lint-only failure uses `low`.

Status: the loop writes `STATUS_FILE` (default `/tmp/<project>-loop.status.json`): phase, model, agent, issue, startedAt, lastOutputAt, pid. Scripts and coordinators read this file, not the log.

Self-test: `scripts/check-blueprint.sh` (in a project: `npx tsx .sandcastle/loop-policy-test.mts` and `scripts/test-stop-gate.sh`).

## Lessons (retro 2026-11-13)

- A loop stalled from 09:32 to 11:36 after a Claude limit: the 30-minute pause used a timer that stops while the box sleeps. Use wall-clock deadlines (rule 1).
- On a limit the chain fell from Opus to Sonnet to Composer in 4 s: the Claude models share one limit. Skip them and go back to Claude after the parsed reset (rule 1).
- An xtensa compile error (non-exhaustive `match`) showed only at the end of the merge gate. Run the cross-compile check right after the implementer (rule 4).
- A 600 s idle timeout stopped a long build (calendar #83). Use 1800 s (rule 3).
- Issues were skipped as "no commit" when the agent stopped early. The Stop hook makes the same session finish the commit (rule 2).
- Each phase read about 25 KB of documents and the same prohibitions three times. Short prompts and `permissions.deny` replace that (rules 5, 6).
- Keep the merge gate local when GitHub Actions is blocked: merge only after a green local CI on the exact PR head SHA.
- Do not use cloud agents or Claude Code projects for the loop: it needs the box and the device. Do not use auto mode without a human: a blocked tool call has no one to approve it.

## 5. CI gates

- Required jobs on main: `format`, `lint`, `test`, `crap`, `secrets`. Do not rename them.
- A missing file is a failure. Do not skip a step.
- `crap` fails when a unit has CRAP >= limit, and when it analyzed 0 units.
- `secrets` runs gitleaks on the full history and an optional deny-list from the `DENYLIST` secret.

## 6. Merge

- Auto-merge on green: the loop squash-merges only when all CI checks pass on an up-to-date branch.
- Commit and PR rules: see `AGENTS.md`.

## 7. Secrets

- Secrets are never in the repository, in fixtures, in logs or in issue text.
- Local secrets go in `.sandcastle/.env` (ignored by git) or in environment variables on the server.
- CI secrets go in GitHub Actions secrets.
- Real secret addresses or credentials are used only after Tomasz approves them.
