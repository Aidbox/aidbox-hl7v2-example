#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$PROJECT_DIR/logs/server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "Server is not running (no PID file found)"
  exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
  echo "Stopping server (PID: $PID)..."
  kill "$PID"
  rm -f "$PID_FILE"
  echo "Server stopped"
else
  echo "Server process not found (stale PID file)"
  rm -f "$PID_FILE"
fi
