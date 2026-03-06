#!/usr/bin/env bash
set -euo pipefail

go test ./cmd/... ./internal/...
go run ./cmd/fbcli --help >/dev/null
bun test

# The MCP server speaks stdio. Running with stdin closed verifies bootstrap and
# should exit cleanly once it observes EOF.
bun run src/server.ts </dev/null >/tmp/facebook-mcp-final.log 2>&1
