# Python standards

Source: e1003-calendar v1 prototype (`server.py`, `render.py`, `layout.py`). Status: that prototype has no lint, test or CRAP gates. No project of Tomasz has Python gates yet.

## Rule

- Use Python only for a short prototype. See `README.md` (language selection guideline).
- Plan the removal of the prototype in the PRD.
- If a Python project must stay, define its format, lint, test, coverage and CRAP gates in the PRD before the first slice, and record them here. The CI job ids stay `format`, `lint`, `test`, `crap`.
