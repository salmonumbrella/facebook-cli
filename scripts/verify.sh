#!/usr/bin/env bash
set -euo pipefail

bun test
bun run cli/fbcli.ts --help >/dev/null
bun run src/server.ts </dev/null >/tmp/facebook-mcp-final.log 2>&1 &
PID=$!
sleep 2
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
fi
