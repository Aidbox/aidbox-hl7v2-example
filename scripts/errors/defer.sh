#!/bin/bash
# Defer an IncomingHL7v2Message — parks it out of active queue pending sender action.
#
# Usage: scripts/errors/defer.sh <message-id>
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <message-id>" >&2
  exit 2
fi
ID="$1"

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
curl -sf -X POST "http://localhost:3000/defer/$ID" >/dev/null
"$PROJECT_DIR/scripts/errors/status.sh" "$ID"
