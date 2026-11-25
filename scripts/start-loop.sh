#!/usr/bin/env bash
# Start the Sandcastle loop of one project once. Safe to call many times at the same moment.
# Usage: scripts/start-loop.sh <project-name> <repo-dir>
# Each project has its own lock, PID file and log names: /workspace/<project>-loopN.log.
set -euo pipefail
NAME="${1:?project name}"
DIR="${2:?repository directory}"
exec 9>"/tmp/${NAME}-loop.lock"
flock -n 9 || { echo "locked: another start is in progress"; exit 0; }
PIDFILE="/tmp/${NAME}-loop.pid"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "running: pid $(cat "$PIDFILE")"; exit 0
fi
cd "$DIR"
# The box GH_TOKEN can be invalid or read-only. Drop it, then load the project file.
unset GH_TOKEN
if [ -f .sandcastle/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source .sandcastle/.env
  set +a
fi
export PROJECT="${PROJECT:-$NAME}"
export AUTO_MERGE="${AUTO_MERGE:-0}"
export CLAUDE_MODEL="${CLAUDE_MODEL:-claude-sonnet-5-5}"
if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN is missing. Put it in .sandcastle/.env" >&2
  exit 1
fi
LOGDIR="${LOGDIR:-/workspace}"
n=$(ls "$LOGDIR/${NAME}-loop"*.log 2>/dev/null | sed -E "s/.*${NAME}-loop([0-9]+)\.log/\1/" | sort -n | tail -1 || true)
LOG="$LOGDIR/${NAME}-loop$(( ${n:-0} + 1 )).log"
set -o noclobber
: >"$LOG"
set +o noclobber
setsid nohup bash -c "cd '$DIR' && exec npm run sandcastle" >>"$LOG" 2>&1 9>&- &
echo $! >"$PIDFILE"
sleep 5
echo "started: pid $(cat "$PIDFILE") log $LOG"
