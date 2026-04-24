#!/bin/bash
# Print status, error, and meta for one IncomingHL7v2Message.
# Centralizes the docker-compose secret parsing + curl + jq boilerplate
# that appears in every check-errors follow-up.
#
# Usage: scripts/errors/status.sh <message-id>
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

curl -sf -u "root:$SECRET" \
  "http://localhost:8080/fhir/IncomingHL7v2Message/$ID" \
  | jq '{id, status, type, error, sender: ((.sendingApplication // "") + "/" + (.sendingFacility // ""))}'
