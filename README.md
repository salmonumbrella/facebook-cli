# Facebook MCP Server + Go CLI

This repo has two supported surfaces:

- A TypeScript MCP server in `src/`
- A production Go CLI in `cmd/fbcli` and `internal/`

The old Bun-based CLI prototype has been removed. The CLI is Go-only now.

## Repo Layout

- `src/`: TypeScript MCP server and tool handlers
- `cmd/fbcli`: Go binary entrypoint
- `internal/`: Go CLI command wiring, config, auth, output, and Facebook domain code
- [CLI-REFERENCE.md](CLI-REFERENCE.md): command reference for the Go CLI
- [docs/go-cli-README.md](docs/go-cli-README.md): Go CLI setup and usage notes

## Product Surfaces

- Go CLI: the human and shell-facing binary for direct automation, scripting, and release artifacts.
- MCP server: the agent-facing stdio server for Claude Desktop and other MCP clients that need named tools instead of shell commands.

The MCP server stays in TypeScript for now because it is mostly schema registration and transport glue, not performance-sensitive business logic.

## Requirements

- Go `1.25+` for the CLI
- Bun `1.x` for the MCP server and TypeScript tests

## Configuration

Both the Go CLI and the MCP server read the same environment variables. Put them in a repo-root `.env`, export them in your shell, or point the Go CLI at a file with `FBCLI_ENV_PATH`.

```dotenv
FACEBOOK_ASSETS='[
  {
    "fb_page_id":"123456",
    "page_name":"mybusiness",
    "display_name":"My Business Page",
    "page_access_token":"EAA..."
  }
]'

FB_APP_ID=123456789
FB_USER_ACCESS_TOKEN=EAA...
FB_API_VERSION=v25.0
```

`FACEBOOK_ASSETS` is the page registry used by page-scoped commands and MCP tools.

## Run The Go CLI

```bash
go run ./cmd/fbcli --help
go run ./cmd/fbcli pages
go run ./cmd/fbcli auth status
go run ./cmd/fbcli --dry-run ads campaigns list
```

Build a standalone binary with:

```bash
make build
./bin/fbcli --help
```

## Run The MCP Server

```bash
bun install
bun run src/server.ts
```

Example Claude Desktop entry:

```json
"facebook-mcp": {
  "command": "bun",
  "args": ["run", "/path/to/facebook-cli/src/server.ts"],
  "env": {
    "FACEBOOK_ASSETS": "[{\"fb_page_id\":\"123\",\"page_name\":\"mypage\",\"display_name\":\"My Page\",\"page_access_token\":\"EAA...\"}]"
  }
}
```

## Verify

```bash
go test ./cmd/... ./internal/...
bun test
bash scripts/verify.sh
```

## Notes

- GoReleaser ships the Go binary as `fbcli`.
- Git hooks are Go-focused via `lefthook`.
- The TypeScript package remains because `src/` is still the MCP server.
