#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$PROJECT_DIR/logs/server.pid"
LOG_FILE="$PROJECT_DIR/logs/server.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_DIR/logs"

# Stop existing server if running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing server (PID: $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 0.5
  fi
  rm -f "$PID_FILE"
fi

# Start server with hot reload
echo "Starting server with hot reload..."
cd "$PROJECT_DIR"
nohup bun --hot src/index.ts >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "Server started (PID: $(cat "$PID_FILE"))"
echo "Logs: $LOG_FILE"
echo "Run 'bun run logs' to tail logs"
echo "Run 'bun run stop' to stop server"
