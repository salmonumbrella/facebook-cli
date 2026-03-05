# fbcli Quickstart

## First Run

```bash
# Check it works
bun run cli/fbcli.ts pages

# See all commands
bun run cli/fbcli.ts --help
```

## Common Patterns

### Create alias (add to ~/.zshrc)

```bash
alias fbcli='bun run /path/to/facebook-mcp-cli/cli/fbcli.ts'
```

### List pages and posts

```bash
fbcli pages
fbcli posts mybusiness
```

### Create and manage posts

```bash
# New post
fbcli post mybusiness "Hello from the CLI!"

# Post from a file (stdin)
cat draft.txt | fbcli post mybusiness

# Update existing
fbcli update-post mybusiness 123456_789 "Updated message"

# Schedule for later (Unix timestamp)
fbcli schedule mybusiness "Coming soon!" 1738900800

# Schedule with message from stdin
cat announcement.txt | fbcli schedule mybusiness 1738900800

# Delete
fbcli delete-post mybusiness 123456_789
```

### Comment moderation

```bash
# View comments
fbcli comments mybusiness 123456_789

# Reply
fbcli reply mybusiness 111_222 "Thanks for your comment!"

# Reply from stdin
echo "Thanks!" | fbcli reply mybusiness 111_222

# Hide spam
fbcli hide-comment mybusiness 111_222

# Bulk operations (comma-separated IDs, no spaces)
fbcli bulk-hide mybusiness 111_222,333_444,555_666
fbcli bulk-delete mybusiness 111_222,333_444

# Bulk hide with IDs piped from another command
fbcli comments mybusiness 123456_789 \
  | jq -r '.data[].id' \
  | fbcli bulk-hide mybusiness
```

### Analytics

```bash
# Quick overview
fbcli insights mybusiness 123456_789

# Specific metrics
fbcli fans mybusiness
fbcli likes mybusiness 123456_789
fbcli reactions mybusiness 123456_789
fbcli reach mybusiness 123456_789
```

### Pipe to jq

```bash
# Extract page names
fbcli pages | jq '.[].page_name'

# Get post IDs
fbcli posts mybusiness | jq '.data[].id'

# Reaction counts as flat object
fbcli reactions mybusiness 123456_789 | jq .

# Fan count as number
fbcli fans mybusiness | jq -r '.fan_count'
```

### Shell scripting

```bash
# Post to all pages
for page in $(fbcli pages | jq -r '.[].page_name'); do
  fbcli post "$page" "New announcement!"
done

# Hide all comments matching a pattern (direct stdin pipe)
fbcli comments mybusiness 123456_789 \
  | jq -r '.data[] | select(.message | test("spam"; "i")) | .id' \
  | fbcli bulk-hide mybusiness

# DM from a template file
cat welcome.txt | fbcli dm mybusiness 9876543210
```

## v2 Command Groups

```bash
# Auth and profiles
fbcli auth status
fbcli profile list
fbcli profile switch default
fbcli limits check

# Ads
fbcli ads accounts list
fbcli ads campaigns list --account-id 123
fbcli ads audience search-interests --query shopping
fbcli ads stats collect --account-id 123 --since 2026-03-01 --until 2026-03-01

# Business + social
fbcli business info --business-id 123
fbcli invoices list --business-id 123
fbcli ad-library search --params-json '{"ad_reached_countries":"US","search_terms":"shoes"}'
fbcli ig accounts list
fbcli wa templates list --waba-id 123
fbcli page-insights fans 1234567890
```

## Runtime Flags

```bash
fbcli --output table ads campaigns list --account-id 123
fbcli --dry-run ads campaigns create --account-id 123 --payload-json '{"name":"Demo","objective":"OUTCOME_TRAFFIC","status":"PAUSED","special_ad_categories":"[]"}'
fbcli --api-version v25.0 ads accounts list
fbcli --access-token EAA... ads accounts list
fbcli --profile default ads accounts list
```

Profile path: `~/.config/facebook-cli/profiles.json`
