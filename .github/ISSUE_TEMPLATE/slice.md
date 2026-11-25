---
name: Vertical slice
about: One small change that goes through all layers and can merge alone.
title: "<Area>: <what the slice does>"
labels: ["needs-validation", "priority: medium"]
---

## Goal

<One or two sentences. What changes for the user or the system.>

Blocked by #<N>
<Remove this line if nothing blocks the issue. The loop reads "Blocked by #N".>

## Scope

- <Item>
- <Item>

## Out of scope

- <Item>

## Acceptance criteria

- [ ] <Observable result with a test>
- [ ] Tests for the new behaviour. Tests do not use the network.
- [ ] All CI jobs pass: `format`, `lint`, `test`, `crap` (every unit CRAP < limit), `secrets`.
- [ ] No new dependency without a reason in the PR.
