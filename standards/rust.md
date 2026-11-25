# Rust standards

Source: e1003-calendar `docs/PRD-v2.md` (Quality rules) and issue #2. Status: planned, not yet run in a project.

## Tools

- Format: `cargo fmt --check`.
- Lint: `cargo clippy --all-targets -- -D warnings`. Add `#![forbid(unsafe_code)]` to binaries and libraries.
- Tests: unit tests and integration tests with `cargo test`. Test data in `fixtures/`.
- Coverage: `cargo llvm-cov`.
- Complexity: `rust-code-analysis-cli`.
- CRAP: a small tool (`tools/crap`) joins complexity and coverage per function. Limit: CRAP < 4. Print the score in the CI job summary.

## CI jobs

| Job    | Command                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| format | `cargo fmt --check`                                                             |
| lint   | `cargo clippy --all-targets -- -D warnings`                                     |
| test   | `cargo test`                                                                    |
| crap   | `cargo llvm-cov` + `rust-code-analysis-cli` + `tools/crap` (fails on CRAP >= 4) |

Containerfile: add rustup with `rustfmt`, `clippy`, `llvm-tools-preview`, and `cargo-llvm-cov`.

## Code rules

- No `unsafe`.
- Secrets come from environment variables. Never log them.
- Tests do not use the network. Use fixtures.
