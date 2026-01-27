#!/bin/bash
# Run TypeScript type checking, only failing on src/ and test/ errors (not node_modules)

OUTPUT=$(tsc --noEmit 2>&1)
SRC_ERRORS=$(echo "$OUTPUT" | grep -E "^(src|test)/")

if [ -n "$SRC_ERRORS" ]; then
  echo "TypeScript errors:"
  echo "$SRC_ERRORS"
  exit 1
fi

echo "Type check passed (ignoring node_modules errors)"
exit 0
