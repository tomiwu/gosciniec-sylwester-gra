#!/usr/bin/env bash
# Create the standard labels in a GitHub repository. Safe to run again (--force updates).
# Usage: scripts/create-labels.sh owner/repo
set -euo pipefail
REPO="${1:?owner/repo}"
GH="${GH:-gh}"
label() { "$GH" label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }
label "needs-validation" "C5DEF5" "Waiting for Tomasz to validate"
label "Sandcastle"       "F9A825" "Issues for Sandcastle to work on"
label "hardware"         "5319E7" "Needs the real device (done with Tomasz, not by the loop)"
label "priority: critical" "B60205" "Do first"
label "priority: high"     "D93F0B" ""
label "priority: medium"   "FBCA04" "Default when no priority label is set"
label "priority: low"      "0E8A16" ""
