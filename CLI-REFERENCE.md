# fbcli Reference

Supported CLI binary: `fbcli`

## Global Flags

Use global flags before the command group:

```bash
fbcli --output json|table|csv ...
fbcli --dry-run ...
fbcli --api-version v25.0 ...
fbcli --access-token EAA...
fbcli --profile default ...
```

## Core Page Commands

```bash
fbcli pages
fbcli posts <page>
fbcli post <page> [message]
fbcli post-image <page> <url> [caption]
fbcli update-post <page> <post-id> [message]
fbcli delete-post <page> <post-id>
fbcli schedule <page> [message] <timestamp>

fbcli comments <page> <post-id>
fbcli reply <page> <comment-id> [message]
fbcli delete-comment <page> <comment-id>
fbcli hide-comment <page> <comment-id>
fbcli unhide-comment <page> <comment-id>
fbcli bulk-delete <page> [ids]
fbcli bulk-hide <page> [ids]
```

Commands with `[message]` or `[ids]` also accept stdin when the argument is omitted or replaced with `-`.

## Analytics

```bash
fbcli insights <page> <post-id>
fbcli fans <page>
fbcli likes <page> <post-id>
fbcli shares <page> <post-id>
fbcli reactions <page> <post-id>
fbcli impressions <page> <post-id>
fbcli reach <page> <post-id>
fbcli clicks <page> <post-id>
fbcli engaged <page> <post-id>
fbcli top-commenters <page> <post-id>
fbcli comment-count <page> <post-id>
```

## Media, Stories, and Experiments

```bash
fbcli dm <page> <user-id> [message]
fbcli publish-reel <page> <url|file> [description]
fbcli reels <page>
fbcli video-status <page> <video-id>
fbcli publish-video <page> <url|file> [title] [--description TEXT]
fbcli video-story <page> <url|file>
fbcli photo-story <page> <photo-url>
fbcli stories <page>
fbcli slideshow <page> <url1,url2,...> [--duration MS] [--transition MS]
fbcli music [--type popular|new|foryou] [--country US]
fbcli crosspost <page> <video-id>
fbcli enable-crosspost <page> <video-id> <page-ids>
fbcli crosspost-pages <page>
fbcli crosspost-check <page> <video-id>
fbcli ab-create <page> <name> <goal> <video-ids> <control-id> [--desc TEXT] [--duration SECONDS]
fbcli ab-results <page> <test-id>
fbcli ab-tests <page> [--since DATE] [--until DATE]
fbcli ab-delete <page> <test-id>
```

## Auth, Profile, and Limits

```bash
fbcli auth login
fbcli auth status
fbcli auth logout
fbcli auth refresh
fbcli auth doctor

fbcli profile add <name> [--access-token TOKEN]
fbcli profile switch <name>
fbcli profile show [name]
fbcli profile remove <name>
fbcli profile list

fbcli limits check
```

Profile storage path: `~/.config/facebook-cli/profiles.json`

## Ads

```bash
fbcli ads accounts list|get
fbcli ads campaigns list|get|create|update|pause|activate|delete
fbcli ads adsets list|get|create|update
fbcli ads ads list|get|create|update
fbcli ads creatives list|get|create
fbcli ads images upload
fbcli ads insights get
fbcli ads audiences list|get|create|update|delete
fbcli ads deploy <config-path> <account-id>
fbcli ads validate <config-path>
fbcli ads audience search-interests|search-behaviors|estimate-size
fbcli ads duplicate <campaign-id> <target-account-id> [name] [budget-factor]
fbcli ads stats collect|analyze|validate|export
fbcli ads optimize validate|create|update
fbcli ads exportyaml <campaign-id>
```

## Business, Instagram, and WhatsApp

```bash
fbcli business info <business-id>
fbcli business ad-accounts <business-id>
fbcli invoices list <business-id> [since] [until]
fbcli invoices download <invoice-id>
fbcli ad-library search <query>

fbcli ig accounts list
fbcli ig media list <ig-user-id>
fbcli ig media insights <media-id>
fbcli ig account insights <ig-user-id>
fbcli ig comments list <media-id>
fbcli ig comments reply <comment-id> <message>
fbcli ig publish <ig-user-id> <image-url> [caption]
fbcli ig stories list <ig-user-id>

fbcli wa send <phone-number-id> <to> [message]
fbcli wa templates list <waba-id>
fbcli wa templates create <waba-id> <payload-json>
fbcli wa phone-numbers list <waba-id>
```

## Page Enhancements

```bash
fbcli page-insights <metric|alias> <page-id>
fbcli page-insights fans <page-id>
fbcli page-insights reach <page-id>
fbcli page-insights views <page-id>
fbcli page-insights engagement <page-id>
fbcli post-local <page-id> <file-path> [caption]
fbcli draft <page-id> <message>
fbcli me
```

## Config

The CLI reads config from process env first, then from a discovered repo-root `.env`. You can override the file location with `FBCLI_ENV_PATH`.

```dotenv
FACEBOOK_ASSETS='[{"fb_page_id":"123","page_name":"demo","display_name":"Demo","page_access_token":"EAA..."}]'
FB_ACCESS_TOKEN=EAA...
FB_APP_ID=123456789
FB_USER_ACCESS_TOKEN=EAA...
FB_API_VERSION=v25.0
```
