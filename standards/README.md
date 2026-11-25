# Coding standards per language

Each file lists the tools, the CI gates and the code rules that a real project uses. Copy the rules of your language into `.sandcastle/CODING_STANDARDS.md` (short form) and into `.sandcastle/checks.json` and `.github/workflows/ci.yml` (commands).

| File             | Source project                                                    | CRAP limit |
| ---------------- | ----------------------------------------------------------------- | ---------- |
| `scala.md`       | crap4s                                                            | < 4        |
| `typescript.md`  | automations                                                       | < 6        |
| `rust.md`        | e1003-calendar v2 (PRD, issue #2; plan, not yet built)            | < 4        |
| `cpp-esphome.md` | e1003-calendar v2 (PRD, issues #3, #18, #19; plan, not yet built) | < 4        |
| `python.md`      | e1003-calendar v1 prototype (no gates)                            | not set    |

CRAP formula (all languages): `CRAP = CC^2 * (1 - coverage)^3 + CC`. CC is the cyclomatic complexity of the unit. Coverage is a fraction from 0 to 1.

## Language selection guideline

- For new host code (servers, CLIs, tools), use Rust before Python.
- Use Python only for a short prototype. Plan its removal in the PRD (e1003-calendar: "Python is retired after v2 works").
- Use the language that the platform requires when there is no choice (Scala for Scala tooling, C++ for ESPHome, TypeScript for a Node platform).
