#!/bin/bash
# After a fix, verify the message converts cleanly, then mark for retry,
# trigger reprocessing, and poll status. Chains the typical 3-4 commands
# into one call so a fix → verify → retry cycle is a single step.
#
# Requires: scripts/errors/inspect-error.sh <id> has been run first so the
# raw HL7v2 lives at /tmp/hl7v2-<id>.hl7.
#
# Usage: scripts/errors/verify-retry.sh <message-id>
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <message-id>" >&2
  exit 2
fi
ID="$1"

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="/tmp/hl7v2-$ID.hl7"
if [ ! -f "$FIXTURE" ]; then
  echo "ERROR: $FIXTURE missing. Run scripts/errors/inspect-error.sh $ID first." >&2
  exit 1
fi

echo "### Verify"
VERIFY_OUT=$(bun "$PROJECT_DIR/scripts/check-message-support.ts" "$FIXTURE")
echo "$VERIFY_OUT"
if ! printf '%s\n' "$VERIFY_OUT" | grep -qiE '^Verdict: +supported'; then
  echo
  echo "### Aborted — verdict is not 'supported'. Fix before retrying." >&2
  exit 1
fi

echo
echo "### Retry"
curl -sf -X POST "http://localhost:3000/mark-for-retry/$ID"
curl -sf -X POST 'http://localhost:3000/process-incoming-messages'
echo "retry triggered"
echo

echo "### Status"
"$PROJECT_DIR/scripts/errors/status.sh" "$ID"
