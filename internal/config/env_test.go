package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseCLIEnv(t *testing.T) {
	parsed := ParseCLIEnv(`FB_APP_ID="123"
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

func TestLoadEnvironmentFindsCLIEnvInParentTree(t *testing.T) {
	root := t.TempDir()
	cliDir := filepath.Join(root, "cli")
	if err := os.MkdirAll(cliDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	cliEnvPath := filepath.Join(cliDir, ".env")
	if err := os.WriteFile(cliEnvPath, []byte("FB_APP_ID=123\n"), 0o600); err != nil {
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
		t.Fatalf("expected cli/.env value, got %q ok=%v", got, ok)
	}
	if env.CLIEnvPath() != cliEnvPath {
		t.Fatalf("expected cli env path %q, got %q", cliEnvPath, env.CLIEnvPath())
	}
}

func TestProfileStorePathForHome(t *testing.T) {
	home := "/tmp/fb-home"
	want := filepath.Join(home, ".config", AppName, "profiles.json")
	if got := ProfileStorePathForHome(home); got != want {
		t.Fatalf("ProfileStorePathForHome() = %q, want %q", got, want)
	}
}
