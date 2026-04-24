#!/bin/bash
# Resolve an unmapped code mapping task. Auto-requeues the message.
# Wraps the form-urlencoded POST + 302 parsing.
#
# Usage: scripts/errors/resolve-mapping.sh <taskId> <resolvedCode> <resolvedDisplay>
set -e

if [ $# -lt 3 ]; then
  echo "Usage: $0 <taskId> <resolvedCode> <resolvedDisplay>" >&2
  exit 2
fi

TASK_ID="$1"
CODE="$2"
DISPLAY="$3"

RESP=$(curl -s -X POST "http://localhost:3000/api/mapping/tasks/$TASK_ID/resolve" \
  --data-urlencode "resolvedCode=$CODE" \
  --data-urlencode "resolvedDisplay=$DISPLAY" \
  -D - -o /dev/null)

STATUS=$(printf '%s' "$RESP" | awk 'NR==1 {print $2}')
LOCATION=$(printf '%s' "$RESP" | awk -F': ' 'tolower($1)=="location" {print $2}' | tr -d '\r')

if [ "$STATUS" = "302" ]; then
  echo "resolved: $CODE ($DISPLAY)"
  echo "redirect: $LOCATION"
else
  echo "ERROR: expected 302, got $STATUS" >&2
  printf '%s\n' "$RESP" >&2
  exit 1
fi
