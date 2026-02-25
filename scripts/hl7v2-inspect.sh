#!/usr/bin/env bash
# Thin wrapper around hl7v2-inspect.py so Claude Code grants permission once.
exec python3 "$(dirname "$0")/hl7v2-inspect.py" "$@"
