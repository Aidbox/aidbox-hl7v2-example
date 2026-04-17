#!/usr/bin/env bash
# Thin wrapper around hl7v2-inspect.py so Claude Code grants permission once.
if python3 --version &>/dev/null; then
  PYTHON=python3
elif python --version &>/dev/null; then
  PYTHON=python
elif py --version &>/dev/null; then
  PYTHON=py
else
  echo "Error: Python not found"; exit 1
fi
exec "$PYTHON" "$(dirname "$0")/hl7v2-inspect.py" "$@"
