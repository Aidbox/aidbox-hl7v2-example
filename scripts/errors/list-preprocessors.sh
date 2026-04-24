#!/bin/bash
# List available HL7v2 segment preprocessors (by ID) with the first line
# of the JSDoc above each implementation, so the check-errors skill can
# pick the right preprocessor without grepping the registry.
#
# Usage: scripts/errors/list-preprocessors.sh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
REG="$PROJECT_DIR/src/v2-to-fhir/preprocessor-registry.ts"

if [ ! -f "$REG" ]; then
  echo "ERROR: $REG not found" >&2
  exit 1
fi

awk '
  # Phase 1: collect id → function-name mapping from SEGMENT_PREPROCESSORS literal.
  /^export const SEGMENT_PREPROCESSORS/ { in_map = 1; next }
  in_map && /^\};/ { in_map = 0; next }
  in_map {
    if (match($0, /"([a-z0-9-]+)":[[:space:]]+([a-zA-Z0-9_]+)/, m)) {
      fn2id[m[2]] = m[1]
      order[++n] = m[1]
    }
  }

  # Phase 2: capture JSDoc + function-name pairs anywhere in the file.
  /^\/\*\*/ { doc = ""; in_doc = 1; next }
  in_doc && /\*\// { in_doc = 0; next }
  in_doc {
    line = $0
    sub(/^[[:space:]]*\*[[:space:]]?/, "", line)
    if (line != "" && doc == "") doc = line
    next
  }
  /^function [a-zA-Z0-9_]+\(/ {
    if (match($0, /^function ([a-zA-Z0-9_]+)\(/, m)) {
      if (m[1] in fn2id) {
        id = fn2id[m[1]]
        desc[id] = doc
      }
      doc = ""
    }
  }

  END {
    for (i = 1; i <= n; i++) {
      id = order[i]
      d = (id in desc) ? desc[id] : ""
      if (d == "") printf "- %s\n", id
      else printf "- %s — %s\n", id, d
    }
  }
' "$REG"
