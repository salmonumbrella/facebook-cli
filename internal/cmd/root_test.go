package cmd

import (
	"context"
	"strings"
	"testing"
)

func TestExecute_HelpContainsCoreCommands(t *testing.T) {
	_ = withTempHome(t)

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"--help"}); err != nil {
			t.Fatalf("help failed: %v", err)
		}
	})

	for _, token := range []string{"auth", "ads", "business", "pages"} {
		if !strings.Contains(output, token) {
			t.Fatalf("help output missing %q", token)
		}
	}
}

func TestExecute_SubcommandHelp(t *testing.T) {
	_ = withTempHome(t)

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"ads", "--help"}); err != nil {
			t.Fatalf("ads help failed: %v", err)
		}
	})

	if !strings.Contains(output, "Ads API commands") {
		t.Fatalf("ads help output missing summary: %s", output)
	}
}

func TestExecute_InvalidCommandReturnsError(t *testing.T) {
	_ = withTempHome(t)

	err := Execute(context.Background(), []string{"definitely-not-a-command"})
	if err == nil {
		t.Fatal("expected invalid command error")
	}
	if !strings.Contains(err.Error(), `unknown command "definitely-not-a-command"`) {
		t.Fatalf("unexpected invalid command error: %v", err)
	}
}

func TestExecute_DryRunSmokeCommands(t *testing.T) {
	_ = withTempHome(t)
	t.Setenv("FACEBOOK_ASSETS", `[
		{"fb_page_id":"123","page_name":"demo","display_name":"Demo Page","page_access_token":"page-token-123"}
	]`)

	tests := []struct {
		name     string
		args     []string
		contains string
	}{
		{
			name:     "ads accounts list",
			args:     []string{"--dry-run", "ads", "accounts", "list", "--output", "json"},
			contains: `"route": "ads accounts list"`,
		},
		{
			name:     "business info",
			args:     []string{"--dry-run", "business", "info", "biz_123", "--output", "json"},
			contains: `"route": "business info"`,
		},
		{
			name:     "invoices list",
			args:     []string{"--dry-run", "invoices", "list", "act_123", "--output", "json"},
			contains: `"route": "invoices list"`,
		},
		{
			name:     "ad library search",
			args:     []string{"--dry-run", "ad-library", "search", "shoes", "--output", "json"},
			contains: `"route": "ad-library search"`,
		},
		{
			name:     "instagram media list",
			args:     []string{"--dry-run", "ig", "media", "list", "ig_123", "--output", "json"},
			contains: `"route": "ig media list"`,
		},
		{
			name:     "whatsapp templates list",
			args:     []string{"--dry-run", "wa", "templates", "list", "wa_123", "--output", "json"},
			contains: `"route": "wa templates list"`,
		},
		{
			name:     "page insights",
			args:     []string{"--dry-run", "page-insights", "fans", "123", "--output", "json"},
			contains: `"route": "page-insights fans 123"`,
		},
		{
			name:     "post local",
			args:     []string{"--dry-run", "post-local", "123", "./photo.jpg", "caption", "--output", "json"},
			contains: `"route": "post-local 123 ./photo.jpg caption"`,
		},
		{
			name:     "draft",
			args:     []string{"--dry-run", "draft", "123", "hello world", "--output", "json"},
			contains: `"route": "draft 123 hello world"`,
		},
		{
			name:     "page post",
			args:     []string{"--dry-run", "post", "demo", "hello world", "--output", "json"},
			contains: `"dry_run": true`,
		},
		{
			name:     "bulk hide",
			args:     []string{"--dry-run", "bulk-hide", "demo", "c1,c2", "--output", "json"},
			contains: `"relative_url": "c1"`,
		},
		{
			name:     "publish reel",
			args:     []string{"--dry-run", "publish-reel", "demo", "./video.mp4", "--output", "json"},
			contains: `"route": "publish-reel"`,
		},
		{
			name:     "publish video",
			args:     []string{"--dry-run", "publish-video", "demo", "./video.mp4", "--output", "json"},
			contains: `"route": "publish-video"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := captureStdout(t, func() {
				if err := Execute(context.Background(), tt.args); err != nil {
					t.Fatalf("command failed: %v", err)
				}
			})
			if !strings.Contains(output, tt.contains) {
				t.Fatalf("output missing %q: %s", tt.contains, output)
			}
		})
	}
}
