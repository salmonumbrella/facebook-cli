package cmd

import (
	"context"
	"testing"

	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

func TestGoldenAuthStatusDefaultJSON(t *testing.T) {
	home := withTempHome(t)
	seedProfileStore(t, home, profile.StoreData{
		Active: "default",
		Profiles: map[string]profile.Data{
			"default": {
				AccessToken: "profile-token-1234567890",
				Auth: &profile.AuthData{
					Provider:   "facebook_oauth",
					ObtainedAt: "2026-03-01T00:00:00Z",
					ExpiresAt:  "2026-04-01T00:00:00Z",
					TokenType:  "bearer",
					Scopes:     []string{"ads_read", "pages_show_list"},
					UserID:     "user_123",
					AppID:      "app_123",
				},
			},
		},
	})

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"auth", "status", "--output", "json"}); err != nil {
			t.Fatalf("auth status failed: %v", err)
		}
	})

	assertGolden(t, "auth_status_default.json", output)
}

func TestGoldenAuthStatusEnvTokenJSON(t *testing.T) {
	home := withTempHome(t)
	seedProfileStore(t, home, profile.StoreData{
		Active: "default",
		Profiles: map[string]profile.Data{
			"default": {
				AccessToken: "profile-token-1234567890",
			},
		},
	})
	t.Setenv("FB_ACCESS_TOKEN", "env-token-abcdef123456")

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"auth", "status", "--output", "json"}); err != nil {
			t.Fatalf("auth status with env token failed: %v", err)
		}
	})

	assertGolden(t, "auth_status_env_token.json", output)
}

func TestGoldenProfileListJSON(t *testing.T) {
	home := withTempHome(t)
	seedProfileStore(t, home, profile.StoreData{
		Active: "work",
		Profiles: map[string]profile.Data{
			"default": {
				AccessToken: "default-token-123456",
			},
			"personal": {},
			"work": {
				AccessToken: "work-token-123456",
			},
		},
	})

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"profile", "list", "--output", "json"}); err != nil {
			t.Fatalf("profile list failed: %v", err)
		}
	})

	assertGolden(t, "profile_list.json", output)
}

func TestGoldenPagesJSON(t *testing.T) {
	_ = withTempHome(t)
	t.Setenv("FACEBOOK_ASSETS", `[
		{"fb_page_id":"123","page_name":"demo","display_name":"Demo Page","page_access_token":"page-token-123"},
		{"fb_page_id":"456","page_name":"brand","display_name":"Brand Page","page_access_token":"page-token-456"}
	]`)

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"pages", "--output", "json"}); err != nil {
			t.Fatalf("pages failed: %v", err)
		}
	})

	assertGolden(t, "pages.json", output)
}

func TestGoldenLimitsCheckJSON(t *testing.T) {
	_ = withTempHome(t)
	t.Setenv("FB_X_APP_USAGE", `{"call_count":17,"cpu_time":9}`)
	t.Setenv("FB_X_BUSINESS_USE_CASE_USAGE", `{"type":"ads_management","call_count":5}`)

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"limits", "check", "--output", "json"}); err != nil {
			t.Fatalf("limits check failed: %v", err)
		}
	})

	assertGolden(t, "limits_check.json", output)
}

func TestGoldenMeDryRunJSON(t *testing.T) {
	_ = withTempHome(t)

	output := captureStdout(t, func() {
		if err := Execute(context.Background(), []string{"--dry-run", "me", "--output", "json"}); err != nil {
			t.Fatalf("me dry-run failed: %v", err)
		}
	})

	assertGolden(t, "me_dry_run.json", output)
}
