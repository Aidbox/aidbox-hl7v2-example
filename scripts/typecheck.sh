#!/bin/bash
# Run TypeScript type checking, only failing on src/ errors (not node_modules)

OUTPUT=$(tsc --noEmit 2>&1)
SRC_ERRORS=$(echo "$OUTPUT" | grep "^src/")

if [ -n "$SRC_ERRORS" ]; then
  echo "TypeScript errors in src/:"
  echo "$SRC_ERRORS"
  exit 1
fi

echo "Type check passed (ignoring node_modules errors)"
exit 0
