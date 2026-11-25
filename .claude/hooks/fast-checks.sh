#!/usr/bin/env bash
# Quick checks for the Stop hook. Keep this short.
set -euo pipefail
: "${LOOP_RANGE:=HEAD~1}"
npm run typecheck
npx vitest run
