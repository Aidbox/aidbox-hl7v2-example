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
ERROR_TEXT=$(printf '%s' "$JSON" | jq -r '.error // ""')
if [ -z "$ERROR_TEXT" ]; then
  echo "(no error field)"
else
  echo "$ERROR_TEXT"
fi
echo

UNMAPPED=$(printf '%s' "$JSON" | jq -c '.unmappedCodes // []')
if [ "$UNMAPPED" != "[]" ]; then
  echo "### Unmapped codes"
  printf '%s' "$JSON" | jq -r '
    . as $root |
    .unmappedCodes[]? |
    . as $u |
    ($u.mappingTask.reference // "" | sub("^Task/"; "")) as $taskId |
    ([$root.entries[]? | select(.resourceType == "Task" and .id == $taskId)] | first) as $task |
    "- localCode=`\($u.localCode // "")` system=`\($u.localSystem // "")` display=`\($u.localDisplay // "")` mappingType=`\($task.code.coding[0].code // "")` taskId=`\($taskId)`"
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

# For HTTP 422 Aidbox validation failures: parse the OperationOutcome,
# map the FHIR expression back to HL7v2 source fields via the V2-to-FHIR IG
# mapping CSVs, and print a cheatsheet line for known FHIR constraints.
if [ "$STATUS" = "conversion_error" ] && printf '%s' "$ERROR_TEXT" | grep -q 'HTTP 422'; then
  OO_JSON=$(printf '%s' "$ERROR_TEXT" | sed -n 's/^HTTP 422: //p')
  if [ -n "$OO_JSON" ]; then
    EXPRESSIONS=$(printf '%s' "$OO_JSON" | jq -r '.issue[]?.expression[]? // empty' 2>/dev/null || true)
    DIAGNOSTICS=$(printf '%s' "$OO_JSON" | jq -r '.issue[]?.diagnostics // empty' 2>/dev/null || true)
    CONSTRAINT_ID=$(printf '%s' "$DIAGNOSTICS" | sed -n "s/.*Invalid constraint result for ID '\\([^']*\\)'.*/\\1/p" | head -1)

    if [ -n "$EXPRESSIONS" ] || [ -n "$CONSTRAINT_ID" ]; then
      echo
      echo "### 422 diagnosis"

      if [ -n "$CONSTRAINT_ID" ]; then
        case "$CONSTRAINT_ID" in
          per-1)
            echo "- Constraint \`per-1\`: period start must be <= end. Likely: sender reversed start/end fields. Candidate fix: \`swap-if-reversed\` preprocessor with params \`{ a, b }\` pointing at the two date fields."
            ;;
          ref-1)
            echo "- Constraint \`ref-1\`: SHALL have a contained resource or a reference (not both / need one). Likely: empty or dangling reference target."
            ;;
          inv-1|inv-2|inv-3)
            echo "- Constraint \`$CONSTRAINT_ID\`: Identifier invariant. Likely: missing required system/value."
            ;;
          *)
            echo "- Constraint \`$CONSTRAINT_ID\`: see FHIR invariant definition; cross-reference the \`expression\` below."
            ;;
        esac
      fi

      # Map each FHIR expression (e.g. "IncomingHL7v2Message.entries[5].period") to candidate HL7v2 fields.
      if [ -n "$EXPRESSIONS" ]; then
        printf '%s\n' "$EXPRESSIONS" | while IFS= read -r EXPR; do
          [ -z "$EXPR" ] && continue
          # Drop container + index prefix -> keep the FHIR resource path, e.g. "period"
          PATH_TAIL=$(printf '%s\n' "$EXPR" | awk '{
            n = split($0, a, ".")
            if (n >= 3 && a[2] ~ /^entries\[/) {
              out = a[3]
              for (i = 4; i <= n; i++) out = out "." a[i]
              print out
            } else {
              print $0
            }
          }')
          PATH_TAIL=${PATH_TAIL:-$EXPR}

          # Infer FHIR resource from constraint-error coding (schema-id) — more reliable than expression.
          RESOURCE=$(printf '%s' "$OO_JSON" | jq -r '.issue[]?.details.coding[]? | select(.system=="http://aidbox.app/CodeSystem/schema-id") | .code' 2>/dev/null | head -1)

          echo "- FHIR expression \`$EXPR\` (resource=\`${RESOURCE:-?}\`, path=\`$PATH_TAIL\`)"

          if [ -n "$RESOURCE" ]; then
            # Grep the segment CSVs for rows where FHIR Attribute column (col 10) matches the path tail.
            # Match the leaf name (last dotted component) to catch per-subfield mappings.
            LEAF=$(printf '%s' "$PATH_TAIL" | awk -F. '{print $NF}')
            MAPPING_DIR="$PROJECT_DIR/specs/v2-to-fhir/mappings/segments"
            # Files are named "... <SEG>[<Resource>] - ..."
            MATCHING_FILES=$(ls "$MAPPING_DIR" 2>/dev/null | grep -E "\\[$RESOURCE\\]" || true)
            if [ -n "$MATCHING_FILES" ]; then
              CANDIDATES=$(
                printf '%s\n' "$MATCHING_FILES" | while IFS= read -r F; do
                  [ -z "$F" ] && continue
                  awk -F',' -v leaf="$LEAF" -v path="$PATH_TAIL" '
                    NR > 2 {
                      attr = $10
                      gsub(/^[ "]+|[ "]+$/, "", attr)
                      if (attr == "") next
                      # Match when attr equals the path/leaf, or starts with "path." / "leaf."
                      # (catches children like period.start when expression is .period)
                      if (attr == leaf || attr == path \
                          || index(attr, path ".") == 1 \
                          || index(attr, leaf ".") == 1) {
                        id = $2; gsub(/^[ "]+|[ "]+$/, "", id)
                        name = $3; gsub(/^[ "]+|[ "]+$/, "", name)
                        print id " [" attr "] (" name ")"
                      }
                    }
                  ' "$MAPPING_DIR/$F"
                done | sort -u
              )
              if [ -n "$CANDIDATES" ]; then
                echo "  HL7v2 source candidates:"
                printf '%s\n' "$CANDIDATES" | sed 's/^/    - /'
              else
                echo "  (no matching row in IG segment CSVs for path \`$PATH_TAIL\`)"
              fi
            fi
          fi
        done
      fi
    fi
  fi
fi
