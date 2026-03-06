# fbcli (Go)

Go port of the Facebook CLI.

## Run

```bash
go run ./cmd/fbcli --help
```

Examples:

```bash
go run ./cmd/fbcli auth status
go run ./cmd/fbcli --output csv auth status
go run ./cmd/fbcli --dry-run --access-token X ads accounts list
FACEBOOK_ASSETS='[{"fb_page_id":"1","page_name":"demo","display_name":"Demo","page_access_token":"TOKEN"}]' \
  go run ./cmd/fbcli pages
```

## Layout

- `cmd/fbcli`: thin binary entrypoint
- `internal/cmd`: Cobra command wiring
- `internal/api`: Graph API, batch, upload, and retry helpers
- `internal/config`: `cli/.env`, page assets, and runtime resolution
- `internal/profile`: `~/.config/facebook-cli/profiles.json` store
- `internal/auth`: OAuth helpers
- `internal/facebook`: ported domain behavior from the TypeScript CLI
- `internal/output`: JSON, CSV, and table formatting

## Verify

```bash
go test ./...
```
