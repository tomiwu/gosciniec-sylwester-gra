# Scala 3 standards

Source: crap4s (`docs/CODING_STANDARDS.md`, `.github/workflows/ci.yml`, `scripts/self-crap.sh`).

## Tools

- Scala 3, Scala CLI build. All versions are `//> using` directives in `project.scala`. JVM 25 (Temurin). Tests: munit.
- Format: scalafmt (`.scalafmt.conf`, version 3.11.5, `maxColumn = 100`, Scala 3 braceless syntax, `insertEndMarkerMinLines = 20`).
- Compiler options: `-deprecation -feature -unchecked -Werror -Wunused:all -Wvalue-discard -Wnonunit-statement -Wsafe-init`.
- Lint: Scalafix (`.scalafix.conf`): `RemoveUnused`, `DisableSyntax` (no null, return, asInstanceOf, isInstanceOf), `OrganizeImports`, plus local rules in `scalafix/` with their own tests.
- CRAP: crap4s on its own TASTy and `-coverage-out` coverage. Limit: CRAP < 4.

## CI jobs

| Job    | Command                                                                                    |
| ------ | ------------------------------------------------------------------------------------------ |
| format | `scala-cli fmt --check .`                                                                  |
| lint   | `scala-cli compile --test .`, `scala-cli test scalafix`, `scala-cli --power fix --check .` |
| test   | `scala-cli test .`                                                                         |
| crap   | `scripts/self-crap.sh` (fails on CRAP >= 4 and on 0 units)                                 |

Sandcastle `checks.json`: setup `scala-cli compile . --test`; checks `scala-cli test .`, `scala-cli fmt --check .`, `scripts/self-crap.sh`. Containerfile: add Temurin 25 and Scala CLI.

## Code rules

- One concern per file. Compose the pipeline from small steps.
- Model the domain with case classes and enums, not raw strings or tuples.
- A trait only when there are two real implementations or a test double.
- Inject dependencies through parameters. No DI framework.
- Explicit result type on every public or top-level definition.
- No exception may escape. Every failure is a typed `Error` case in `Either`. No `throw`, unwrapped `try`, `.get`, `.head`, `.last`, `.tail`, `.reduce`, `.toInt`, `.toDouble`, `require`, `assert`, `???`.
- Side effects (exit, print, console, env, files, `var`, mutable collections) only in edge files listed in `.scalafix.conf`. Core and pipeline are pure.
- One last-resort guard, in `Main` only: exit 2, one line, no stack trace.
- Modules are capabilities (opaque function types) used with `?=>`. Give them only in `App.scala`.
- Top-level defs, not helper objects. Inline pass-through defs.
- Do not add a file to a Scalafix allow list to pass the lint job.
