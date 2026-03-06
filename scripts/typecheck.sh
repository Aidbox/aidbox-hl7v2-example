#!/bin/bash
# Run TypeScript type checking, only failing on src/ and test/ errors
# Excludes node_modules and src/hl7v2/generated/ (generated code from @atomic-ehr/hl7v2)

OUTPUT=$(tsc --noEmit 2>&1)
SRC_ERRORS=$(echo "$OUTPUT" | grep -E "^(src|test|scripts)/" | grep -v "^src/hl7v2/generated/")

if [ -n "$SRC_ERRORS" ]; then
  echo "TypeScript errors:"
  echo "$SRC_ERRORS"
  exit 1
fi

echo "Type check passed (ignoring node_modules errors)"
exit 0
