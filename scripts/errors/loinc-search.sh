#!/bin/bash
# Search LOINC via Aidbox ValueSet/$expand. Prints top matches as "code — display".
# Wraps the auth + URI encode + jq boilerplate.
#
# Usage: scripts/errors/loinc-search.sh <term> [--count N]
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <term> [--count N]" >&2
  exit 2
fi

TERM="$1"; shift
COUNT=10
while [ $# -gt 0 ]; do
  case "$1" in
    --count) COUNT="$2"; shift ;;
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

ENC=$(printf '%s' "$TERM" | jq -sRr @uri)
RESP=$(curl -sf -u "root:$SECRET" \
  "http://localhost:8080/fhir/ValueSet/\$expand?url=http://loinc.org/vs&filter=${ENC}&count=${COUNT}")

N=$(printf '%s' "$RESP" | jq -r '.expansion.contains | length // 0')
if [ "$N" = "0" ]; then
  echo "(no matches — LOINC package may not be loaded; fall back to domain knowledge)"
  exit 0
fi

printf '%s' "$RESP" | jq -r '.expansion.contains[] | "\(.code) — \(.display)"'
