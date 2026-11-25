#!/usr/bin/env bash
# The own checks of the blueprint (its CI skeleton is for projects): loop-policy unit tests,
# Stop hook tests, shellcheck, JSON syntax, and a strict type check of the loop when TSC is set.
#   TSC=path/to/tsc TSC_TYPEROOTS=path/to/node_modules/@types scripts/check-blueprint.sh
set -euo pipefail
cd "$(dirname "$0")/.."
TSX="${TSX:-$(command -v tsx || echo node_modules/.bin/tsx)}"
echo "== loop-policy tests"
"$TSX" .sandcastle/loop-policy-test.mts | tail -n 1
echo "== Stop hook tests"
scripts/test-stop-gate.sh | tail -n 1
echo "== shellcheck"
shellcheck -S warning .claude/hooks/*.sh scripts/*.sh
echo "shellcheck ok"
echo "== JSON"
for f in .claude/settings.json .sandcastle/checks.json package.json; do
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$f"
done
echo "JSON ok"
if [ -n "${TSC:-}" ]; then
  echo "== tsc --strict"
  "$TSC" --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext \
    --allowImportingTsExtensions --skipLibCheck --types node ${TSC_TYPEROOTS:+--typeRoots "$TSC_TYPEROOTS"} \
    .sandcastle/main.mts .sandcastle/loop-policy-test.mts
  echo "tsc ok"
fi
echo "All blueprint checks passed."
