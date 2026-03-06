package config

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

func TestGraphAPIBase(t *testing.T) {
	if got := GraphAPIBase("v25.0"); got != "https://graph.facebook.com/v25.0" {
		t.Fatalf("GraphAPIBase() = %q", got)
	}
}

func TestResolveAccessToken(t *testing.T) {
	if got := ResolveAccessToken("cli", "env", "profile"); got != "cli" {
		t.Fatalf("expected cli precedence, got %q", got)
	}
	if got := ResolveAccessToken("", "env", "profile"); got != "env" {
		t.Fatalf("expected env precedence, got %q", got)
	}
	if got := ResolveAccessToken("", "", "profile"); got != "profile" {
		t.Fatalf("expected profile precedence, got %q", got)
	}
}

func TestParsePageAssetsRejectsInvalidShape(t *testing.T) {
	_, err := ParsePageAssets(`[{"fb_page_id":"1"}]`)
	if err == nil || !strings.Contains(err.Error(), "invalid shape") {
		t.Fatalf("expected invalid shape error, got %v", err)
	}
}

func TestLoadPageAssetsRejectsInvalidJSON(t *testing.T) {
	env := NewEnvFromValues(map[string]string{
		"FACEBOOK_ASSETS": "{",
	})

	_, err := LoadPageAssets(env)
	if err == nil || err.Error() != "FACEBOOK_ASSETS is not valid JSON" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadPageAssetsFromEnv(t *testing.T) {
	env := NewEnvFromValues(map[string]string{
		"FACEBOOK_ASSETS": `[{"fb_page_id":"1","page_name":"alpha","display_name":"Alpha","page_access_token":"token"}]`,
	})

	assets, err := LoadPageAssets(env)
	if err != nil {
		t.Fatalf("LoadPageAssets() error = %v", err)
	}
	if len(assets) != 1 {
		t.Fatalf("expected 1 asset, got %d", len(assets))
	}
	if assets[0].PageName != "alpha" {
		t.Fatalf("unexpected page asset: %+v", assets[0])
	}
}

func TestLoadAppConfigUsesEnvironmentLookup(t *testing.T) {
	env := NewEnvFromValues(map[string]string{
		"FB_APP_ID":            "cli-app",
		"FB_USER_ACCESS_TOKEN": "cli-token",
	})

	t.Setenv("FB_APP_ID", "process-app")

	cfg := LoadAppConfig(env)
	if cfg.AppID != "process-app" {
		t.Fatalf("expected process env to win, got %q", cfg.AppID)
	}
	if cfg.UserToken != "cli-token" {
		t.Fatalf("expected .env token, got %q", cfg.UserToken)
	}
}

func TestResolveRuntimeContext(t *testing.T) {
	tempHome := t.TempDir()
	t.Setenv("HOME", tempHome)

	profilePath := filepath.Join(tempHome, ".config", AppName, "profiles.json")
	store := profile.NewStore(profilePath)
	if err := store.Save(profile.StoreData{
		Active: "work",
		Profiles: map[string]profile.Data{
			"work": {AccessToken: "profile-token"},
		},
	}); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	env := NewEnvFromValues(map[string]string{
		"FB_API_VERSION":  "v26.0",
		"FB_ACCESS_TOKEN": "env-token",
	})

	runtime, err := ResolveRuntimeContext("json", false, "", "", "", env)
	if err != nil {
		t.Fatalf("ResolveRuntimeContext() error = %v", err)
	}
	if runtime.ProfileName != "work" {
		t.Fatalf("expected active profile work, got %q", runtime.ProfileName)
	}
	if runtime.AccessToken != "env-token" {
		t.Fatalf("expected env token, got %q", runtime.AccessToken)
	}
	if runtime.APIVersion != "v26.0" {
		t.Fatalf("expected env api version, got %q", runtime.APIVersion)
	}

	runtime, err = ResolveRuntimeContext("json", false, "v99.0", "cli-token", "work", env)
	if err != nil {
		t.Fatalf("ResolveRuntimeContext() override error = %v", err)
	}
	if runtime.AccessToken != "cli-token" {
		t.Fatalf("expected cli override token, got %q", runtime.AccessToken)
	}
	if runtime.APIVersion != "v99.0" {
		t.Fatalf("expected cli override api version, got %q", runtime.APIVersion)
	}
}
