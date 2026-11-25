# Context

You work on `{{PROJECT}}`, issue #{{ISSUE}}, branch `{{BRANCH}}`. Do only this issue.

The host writes the full issue (body and comments) to `.sandcastle/context/issue.json` (git-ignored). If the text below is cut, read that file.

<!-- inline-start: .sandcastle/context/issue.json -->

!`mkdir -p .sandcastle/context && printf '*\n' > .sandcastle/context/.gitignore && gh issue view {{ISSUE}} --json number,title,body,comments --jq '{number, title, body, comments: [.comments[].body]}' > .sandcastle/context/issue.json && head -c 15000 .sandcastle/context/issue.json && echo && echo "[Full issue: .sandcastle/context/issue.json ($(wc -c < .sandcastle/context/issue.json) bytes).]"`

<!-- inline-end -->

## Recent commits

!`git log --oneline -10`

# Task

1. Read the issue and its acceptance criteria. Read only the `docs/PRD.md` sections that the issue names. Read the file in `standards/` for the project language.
2. Read the source files and the tests that the change touches.
3. Use Red-Green-Refactor: a failing test first, then the code.
4. Run all commands in `.sandcastle/checks.json`. Fix all failures.
5. Make one commit. Start the message with `RALPH: #{{ISSUE}}`. Write the task, the key decisions and the files changed.
6. End the commit message with `## Verification`: the exact command, and a fenced block with the last lines of its real output (copy them, do not write them). For a performance issue add a before/after table with the measured numbers.

# Facts that the code does not show

- PROJECT: add only facts that an agent cannot read from the code (hardware, external services, owner decisions). Keep this list short.
- Tests do not use the network. Use fakes and invented data. No secrets and no personal data anywhere.
- The host pushes, opens the PR and merges. Do not edit `docs/PRD.md`, `.sandcastle/`, `.claude/` or `.github/`. If the CI must change, describe the change with `gh issue comment {{ISSUE}}`.
- If you cannot continue, write the reason with `gh issue comment {{ISSUE}}`.

When you are done, output:

<promise>COMPLETE</promise>
