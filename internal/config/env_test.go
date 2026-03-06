package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseDotEnv(t *testing.T) {
	parsed := ParseDotEnv(`FB_APP_ID="123"
FB_APP_SECRET=secret
# comment
FB_OAUTH_REDIRECT_URI='http://localhost:8484/callback'
BAD-KEY=nope
`)

	if parsed["FB_APP_ID"] != "123" {
		t.Fatalf("unexpected FB_APP_ID: %q", parsed["FB_APP_ID"])
	}
	if parsed["FB_APP_SECRET"] != "secret" {
		t.Fatalf("unexpected FB_APP_SECRET: %q", parsed["FB_APP_SECRET"])
	}
	if parsed["FB_OAUTH_REDIRECT_URI"] != "http://localhost:8484/callback" {
		t.Fatalf("unexpected redirect URI: %q", parsed["FB_OAUTH_REDIRECT_URI"])
	}
	if _, ok := parsed["BAD-KEY"]; ok {
		t.Fatalf("expected invalid key to be ignored")
	}
}

func TestLoadEnvironmentFindsDotEnvInParentTree(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	envPath := filepath.Join(root, ".env")
	if err := os.WriteFile(envPath, []byte("FB_APP_ID=123\n"), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	startDir := filepath.Join(root, "internal", "cmd")
	if err := os.MkdirAll(startDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	env, err := LoadEnvironment(startDir)
	if err != nil {
		t.Fatalf("LoadEnvironment() error = %v", err)
	}
	if got, ok := env.Lookup("FB_APP_ID"); !ok || got != "123" {
		t.Fatalf("expected .env value, got %q ok=%v", got, ok)
	}
	if env.Path() != envPath {
		t.Fatalf("expected env path %q, got %q", envPath, env.Path())
	}
}

func TestProfileStorePathForHome(t *testing.T) {
	home := "/tmp/fb-home"
	want := filepath.Join(home, ".config", AppName, "profiles.json")
	if got := ProfileStorePathForHome(home); got != want {
		t.Fatalf("ProfileStorePathForHome() = %q, want %q", got, want)
	}
}
