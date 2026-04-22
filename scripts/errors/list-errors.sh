#!/bin/bash
# Summarize IncomingHL7v2Message errors (and deferred reminders) as a markdown table.
# Designed to be called once by the `check-errors` skill to replace multi-step curl+parse.
#
# Usage:
#   scripts/errors/list-errors.sh              # active errors + deferred reminder
#   scripts/errors/list-errors.sh --deferred   # deferred messages only
#   scripts/errors/list-errors.sh --count 50   # page size (default 20)
set -e

MODE="errors"
COUNT=20
while [ $# -gt 0 ]; do
  case "$1" in
    --deferred) MODE="deferred" ;;
    --count) COUNT="$2"; shift ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' "$PROJECT_DIR/docker-compose.yaml")
if [ -z "$SECRET" ]; then
  echo "ERROR: BOX_ROOT_CLIENT_SECRET missing from docker-compose.yaml" >&2
  exit 1
fi

AIDBOX=http://localhost:8080
ERROR_STATUSES="parsing_error,conversion_error,code_mapping_error,sending_error"
ELEMENTS="id,status,type,error,sendingApplication,sendingFacility,meta"

fetch() {
  local status_filter="$1"
  curl -sf -u "root:$SECRET" \
    "$AIDBOX/fhir/IncomingHL7v2Message?status=$status_filter&_sort=-_lastUpdated&_count=$COUNT&_elements=$ELEMENTS"
}

render_table() {
  # stdin: FHIR Bundle JSON; stdout: markdown table
  jq -r '
    def trunc($n): if . == null then "" else gsub("[\r\n]+"; " ") | .[0:$n] end;
    def sender($r): ($r.sendingApplication // "") + "/" + ($r.sendingFacility // "");
    if (.entry // []) | length == 0 then
      empty
    else
      "| # | Status | Type | Sender | Error | ID |",
      "|---|--------|------|--------|-------|----|",
      (.entry
        | to_entries[]
        | .key as $i
        | .value.resource as $r
        | "| \($i + 1) | \($r.status // "") | \($r.type // "") | \(sender($r)) | \($r.error | trunc(80)) | \($r.id) |"
      )
    end
  '
}

count_entries() { jq '(.entry // []) | length'; }

if [ "$MODE" = "deferred" ]; then
  DEFERRED_JSON=$(fetch "deferred")
  TABLE=$(printf '%s' "$DEFERRED_JSON" | render_table)
  N=$(printf '%s' "$DEFERRED_JSON" | count_entries)
  if [ "$N" = "0" ]; then
    echo "No deferred messages."
  else
    echo "**Deferred messages ($N):**"
    echo
    echo "$TABLE"
  fi
  exit 0
fi

# errors mode
ERRORS_JSON=$(fetch "$ERROR_STATUSES")
ERRORS_N=$(printf '%s' "$ERRORS_JSON" | count_entries)
DEFERRED_JSON=$(fetch "deferred")
DEFERRED_N=$(printf '%s' "$DEFERRED_JSON" | count_entries)

if [ "$ERRORS_N" = "0" ] && [ "$DEFERRED_N" = "0" ]; then
  echo "No active errors. No deferred messages."
  exit 0
fi

if [ "$ERRORS_N" = "0" ]; then
  echo "No active errors."
else
  echo "**Active errors ($ERRORS_N):**"
  echo
  printf '%s' "$ERRORS_JSON" | render_table
  echo
fi

if [ "$DEFERRED_N" != "0" ]; then
  echo "**Deferred ($DEFERRED_N):** waiting on external input. Run with \`--deferred\` to list."
fi
