#!/bin/bash
# Batch-classify all active errors into suggested actions.
# Read-only — prints a plan. User still confirms each fix.
#
# Classifications:
#   auto-swap       conversion_error w/ HTTP 422 per-1 (reversed dates)
#   fhir-422        conversion_error w/ HTTP 422 (other constraint — needs preprocessor)
#   sender-missing  conversion_error w/ "required but missing" (defer-candidate)
#   loinc-lookup    code_mapping_error w/ observation-code-loinc
#   code-mapping    code_mapping_error other (check src/code-mapping/mapping-types.ts)
#   parsing-defer   parsing_error (sender fix → defer)
#   aidbox-reject   sending_error (check Aidbox health)
#   other           unrecognized — inspect manually
#
# Usage: scripts/errors/triage.sh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' "$PROJECT_DIR/docker-compose.yaml")
if [ -z "$SECRET" ]; then
  echo "ERROR: BOX_ROOT_CLIENT_SECRET missing from docker-compose.yaml" >&2
  exit 1
fi

ERROR_STATUSES="parsing_error,conversion_error,code_mapping_error,sending_error"
ELEMENTS="id,status,type,error,sendingApplication,sendingFacility"

JSON=$(curl -sf -u "root:$SECRET" \
  "http://localhost:8080/fhir/IncomingHL7v2Message?status=$ERROR_STATUSES&_sort=-_lastUpdated&_count=50&_elements=$ELEMENTS")
N=$(printf '%s' "$JSON" | jq -r '(.entry // []) | length')

if [ "$N" = "0" ]; then
  echo "No active errors."
  exit 0
fi

echo "**Triage plan ($N active errors):**"
echo
echo "| # | Class | Type | ID | Suggested action |"
echo "|---|-------|------|----|------------------|"

printf '%s' "$JSON" | jq -r '
  .entry | to_entries[] |
  .key as $i | .value.resource as $r |
  "\($i + 1)\t\($r.status // "")\t\($r.type // "")\t\($r.id)\t\($r.error // "" | gsub("[\r\n]+"; " "))"
' | while IFS=$'\t' read -r IDX STATUS TYPE ID ERR; do
  case "$STATUS" in
    conversion_error)
      if printf '%s' "$ERR" | grep -q "HTTP 422"; then
        if printf '%s' "$ERR" | grep -q "per-1"; then
          CLASS="auto-swap"
          ACTION="\`inspect-error.sh $ID\` → run emitted \`wire-preprocessor.ts\` line → \`verify-retry.sh\`"
        else
          CLASS="fhir-422"
          ACTION="\`inspect-error.sh $ID\` → pick preprocessor from candidates"
        fi
      elif printf '%s' "$ERR" | grep -q "required but missing"; then
        CLASS="sender-missing"
        ACTION="likely \`defer.sh $ID\` (sender must populate field)"
      else
        CLASS="conv-other"
        ACTION="\`inspect-error.sh $ID\`"
      fi
      ;;
    code_mapping_error)
      CLASS="loinc-lookup"
      ACTION="\`inspect-error.sh $ID\` (auto LOINC candidates) → \`resolve-mapping.sh <taskId> <code> <display>\`"
      ;;
    parsing_error)
      CLASS="parsing-defer"
      ACTION="\`defer.sh $ID\` (sender must fix malformed message)"
      ;;
    sending_error)
      CLASS="aidbox-reject"
      ACTION="check \`curl http://localhost:8080/health\` → \`inspect-error.sh $ID\`"
      ;;
    *)
      CLASS="other"
      ACTION="\`inspect-error.sh $ID\`"
      ;;
  esac
  echo "| $IDX | $CLASS | $TYPE | \`$ID\` | $ACTION |"
done
