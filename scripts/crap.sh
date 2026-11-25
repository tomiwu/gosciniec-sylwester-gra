#!/usr/bin/env bash
# CRAP gate for TypeScript. Fail when a unit has CRAP >= LIMIT, or when 0 units are analyzed.
set -euo pipefail
LIMIT="${CRAP_LIMIT:-6}"
OUT="${TMPDIR:-/tmp}/crap4ts-out.txt"
# --output is a format name, not a file path. The tool also prints the test log.
# Exclude tests, the Vite entry, and type/catalog modules with no functions to score.
npx @sebassdc/crap4ts \
  --fail-on-crap "$LIMIT" \
  --json \
  --exclude .test \
  --exclude main.ts \
  --exclude i18n \
  --exclude types.ts \
  >"$OUT"
python3 - "$OUT" "$LIMIT" <<'PY'
import json, sys
from pathlib import Path
raw = Path(sys.argv[1]).read_text()
start, end = raw.find("{"), raw.rfind("}")
if start < 0 or end <= start:
    print("crap4ts wrote no JSON report. An empty report is a failure.", file=sys.stderr)
    sys.exit(1)
data = json.loads(raw[start : end + 1])
entries = data.get("entries") or []
if len(entries) == 0:
    print("crap4ts analyzed 0 units. This is a failure.", file=sys.stderr)
    sys.exit(1)
limit = float(sys.argv[2])
bad = [e for e in entries if float(e.get("crap", 0)) >= limit]
print(f"crap4ts: {len(entries)} units, limit CRAP < {limit:g}.")
for e in entries:
    print(f"  {e.get('module')}.{e.get('name')} CRAP={e.get('crap')} CC={e.get('complexity')} cov={e.get('coverage')}")
if bad:
    print("Units at or above the CRAP limit:", file=sys.stderr)
    for e in bad:
        print(f"  {e.get('module')}.{e.get('name')} CRAP={e.get('crap')}", file=sys.stderr)
    sys.exit(1)
PY
