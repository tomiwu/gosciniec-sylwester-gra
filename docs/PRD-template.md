# PRD: <project>

Status: DRAFT. Waiting for validation by Tomasz.

Copy this file to `docs/PRD.md`. Keep sentences short. Write in ASD-STE100. Number every requirement, so issues can refer to it (F1, N1, R1).

## Problem

<What is wrong now. Use numbers when you have them.>

## Goal

<What is true when the project is done.>

## Users

<Who uses it.>

## Architecture

1. <Component, language, where it runs.>
2. <Data flow.>
3. <Where secrets live. Secrets are never in the repository.>

## Requirements

Functional:

- F1 <...>

Non-functional:

- N1 <Speed, size, battery, availability. Give a number.>
- N2 Secrets are never in the repository or in logs.

## Quality rules

- Language standard: `standards/<language>.md`.
- Format, lint with warnings as errors, tests, coverage.
- CRAP score per unit = CC^2 \* (1 - coverage)^3 + CC. CI fails when a unit has CRAP >= <limit> (default 4).
- Every merge to main needs a green CI. Sandcastle loop and PR flow: `docs/WORKFLOW.md`.

## Out of scope

- <Item>

## Success metrics

- <How you measure the goal. Compare with the numbers in Problem.>

## Risks

- R1 <Risk>. Fallback or mitigation: <...>.

## Delivery

Issues are in GitHub. All issues start with `needs-validation`. The `Sandcastle` label is added only after Tomasz validates the issues. Issues that need real hardware carry `hardware` and are done by hand.

## Open questions

- <Question>
