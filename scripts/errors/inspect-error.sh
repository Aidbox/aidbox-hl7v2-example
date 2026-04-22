#!/bin/bash
# Fetch one IncomingHL7v2Message, print the diagnosis-relevant fields,
# save the raw HL7v2 to a temp file, and (for parsing/conversion errors)
# run hl7v2-inspect.sh on it automatically.
#
# Usage: scripts/errors/inspect-error.sh <message-id>
#
# Collapses the typical 2-3 curl+read+save+inspect turns in `check-errors`
# into a single invocation.
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <message-id>" >&2
  exit 2
fi
ID="$1"

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' "$PROJECT_DIR/docker-compose.yaml")
if [ -z "$SECRET" ]; then
  echo "ERROR: BOX_ROOT_CLIENT_SECRET missing from docker-compose.yaml" >&2
  exit 1
fi

JSON=$(curl -sf -u "root:$SECRET" "http://localhost:8080/fhir/IncomingHL7v2Message/$ID")
if [ -z "$JSON" ]; then
  echo "No message with ID $ID" >&2
  exit 1
fi

STATUS=$(printf '%s' "$JSON" | jq -r '.status // ""')
TYPE=$(printf '%s' "$JSON" | jq -r '.type // ""')
SENDER=$(printf '%s' "$JSON" | jq -r '(.sendingApplication // "") + "/" + (.sendingFacility // "")')

echo "## Message $ID"
echo
echo "- Status: \`$STATUS\`"
echo "- Type:   \`$TYPE\`"
echo "- Sender: \`$SENDER\`"
echo

echo "### Error"
printf '%s' "$JSON" | jq -r '.error // "(no error field)"'
echo

UNMAPPED=$(printf '%s' "$JSON" | jq -c '.unmappedCodes // []')
if [ "$UNMAPPED" != "[]" ]; then
  echo "### Unmapped codes"
  printf '%s' "$JSON" | jq -r '
    .unmappedCodes[]? |
    "- code=`\(.code // "")` system=`\(.system // "")` display=`\(.display // "")` mappingType=`\(.mappingType // "")`"
  '
  echo
fi

RAW=$(printf '%s' "$JSON" | jq -r '.message // ""')
if [ -z "$RAW" ]; then
  echo "(no raw HL7v2 message saved on this resource)"
  exit 0
fi

TMP="/tmp/hl7v2-$ID.hl7"
printf '%s' "$RAW" > "$TMP"
echo "### Raw HL7v2 saved to \`$TMP\`"
echo

# Auto-inspect for parsing/conversion errors — that's where pipe counting matters.
case "$STATUS" in
  parsing_error|conversion_error)
    echo "### hl7v2-inspect overview"
    echo '```'
    "$PROJECT_DIR/scripts/hl7v2-inspect.sh" "$TMP" 2>&1 || true
    echo '```'
    ;;
esac
