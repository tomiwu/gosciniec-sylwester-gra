#!/usr/bin/env bash
# Tests for .claude/hooks/stop-gate.sh (the Claude Code Stop hook of the loop). No network, no cargo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.claude/hooks/stop-gate.sh"
tmp=$(mktemp -d); errf=$(mktemp); trap 'rm -rf "$tmp" "$errf"' EXIT
cd "$tmp"
git init -q . && git config user.email t@example.invalid && git config user.name test
echo a > a.txt && git add a.txt && git commit -qm base
base=$(git rev-parse HEAD)
fails=0
expect() { # name want env... -- stdin
  local name="$1" want="$2"; shift 2
  local rc=0
  env CLAUDE_PROJECT_DIR="$tmp" "$@" "$HOOK" <<<"${STDIN:-{\"stop_hook_active\":false\}}" >/dev/null 2>"$errf" || rc=$?
  if [ "$rc" = "$want" ]; then echo "ok   $name"; else echo "FAIL $name: exit $rc, want $want ($(head -c 200 "$errf"))"; fails=$((fails + 1)); fi
}
gate=(LOOP_STOP_GATE=1 LOOP_PHASE=implementer LOOP_BASE_SHA="$base")
expect "gate off -> allow" 0 LOOP_STOP_GATE=0 LOOP_PHASE=implementer LOOP_BASE_SHA="$base"
expect "implementer without a commit -> block (exit 2)" 2 "${gate[@]}"
echo b > b.txt
expect "uncommitted file -> block" 2 "${gate[@]}"
STDIN='{"stop_hook_active":true}' expect "second stop (stop_hook_active) -> allow" 0 "${gate[@]}"
git add b.txt && git commit -qm "RALPH: #1 add b"
expect "commit without Verification -> block" 2 "${gate[@]}"
git commit -q --amend -m "RALPH: #1 add b" -m "## Verification" -m "- (a) cargo test: ok"
expect "commit with Verification, no crate change -> allow" 0 "${gate[@]}"
expect "reviewer without a commit, clean tree -> allow" 0 LOOP_STOP_GATE=1 LOOP_PHASE=reviewer LOOP_BASE_SHA="$(git rev-parse HEAD)"
mkdir -p .sandcastle/context && echo x > .sandcastle/context/issue.json
expect "git-ignored-by-host context dir is not dirty" 0 LOOP_STOP_GATE=1 LOOP_PHASE=reviewer LOOP_BASE_SHA="$(git rev-parse HEAD)"
if [ "$fails" != 0 ]; then echo "$fails stop-gate test(s) failed."; exit 1; fi
echo "All stop-gate tests passed."
