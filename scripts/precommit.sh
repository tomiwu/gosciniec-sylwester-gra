#!/usr/bin/env bash
# Run local gates before a commit.
set -euo pipefail
npm run format:check
npm run lint
npm run typecheck
npm test
npm run crap
