# C++ / ESPHome standards

Source: e1003-calendar `docs/PRD-v2.md` (Quality rules) and issues #3, #18, #19. Status: planned, not yet run in a project.

## Tools

- YAML: `yamllint` and `esphome config`.
- Build: `esphome compile` with a dummy secrets file (`secrets.yaml.example` copied to `secrets.yaml` in CI). Never commit the real `secrets.yaml`.
- Logic: C++ headers in `esphome/include/` with no ESPHome dependency.
- Host tests: doctest, built with g++ or clang on the CI runner. Fixtures are shared with the host server.
- C++ lint: `clang-format --dry-run -Werror`, `clang-tidy`, `cppcheck` on `esphome/include/`, warnings as errors.
- Coverage: `llvm-cov` (clang) on the host tests.
- Complexity: `rust-code-analysis-cli` (reads C++). CRAP with the same `tools/crap`. Limit: CRAP < 4.
- Lambda size check: a script fails CI when a YAML lambda has more than 5 lines or any branch.

## CI jobs

| Job    | Command                                                                   |
| ------ | ------------------------------------------------------------------------- |
| format | `clang-format --dry-run -Werror`                                          |
| lint   | `yamllint`, `esphome config`, `clang-tidy`, `cppcheck`, lambda size check |
| test   | host doctest build and run; `esphome compile`                             |
| crap   | `llvm-cov` + `rust-code-analysis-cli` + `tools/crap` (fails on CRAP >= 4) |

## Code rules

- Do not write logic in YAML lambdas. A lambda only calls a function from `esphome/include/`.
- Date maths, grids, hit testing, paging and parsing are in headers with host tests.
- Work that needs the real device (timing, refresh, touch mapping, battery, sleep) goes in issues with the label `hardware`.
