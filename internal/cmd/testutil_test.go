package cmd

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/salmonumbrella/facebook-cli/internal/config"
	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()

	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("create stdout pipe: %v", err)
	}
	os.Stdout = w
	t.Cleanup(func() {
		os.Stdout = old
	})

	fn()

	_ = w.Close()
	os.Stdout = old

	var buf bytes.Buffer
	_, _ = io.Copy(&buf, r)
	return buf.String()
}

func assertGolden(t *testing.T, name string, got string) {
	t.Helper()

	path := filepath.Join("testdata", "golden", name)
	if os.Getenv("UPDATE_GOLDEN") != "" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("create golden dir: %v", err)
		}
		if err := os.WriteFile(path, []byte(got), 0o644); err != nil {
			t.Fatalf("write golden file: %v", err)
		}
		return
	}

	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden file: %v", err)
	}
	if string(want) != got {
		t.Fatalf("golden output mismatch for %s (set UPDATE_GOLDEN=1 to update)", name)
	}
}

func withTempHome(t *testing.T) string {
	t.Helper()

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("FBCLI_ENV_PATH", filepath.Join(home, "empty.env"))
	unsetEnv(t,
		"FB_ACCESS_TOKEN",
		"FB_USER_ACCESS_TOKEN",
		"FB_API_VERSION",
		"FB_APP_ID",
		"FB_APP_SECRET",
		"FB_OAUTH_REDIRECT_URI",
		"FB_OAUTH_TIMEOUT_MS",
		"FACEBOOK_ASSETS",
		"FB_X_APP_USAGE",
		"FB_X_BUSINESS_USE_CASE_USAGE",
	)

	return home
}

func seedProfileStore(t *testing.T, home string, data profile.StoreData) string {
	t.Helper()

	path := config.ProfileStorePathForHome(home)
	store := profile.NewStore(path)
	if err := store.Save(data); err != nil {
		t.Fatalf("seed profile store: %v", err)
	}
	return path
}

func unsetEnv(t *testing.T, keys ...string) {
	t.Helper()

	for _, key := range keys {
		key := key
		value, ok := os.LookupEnv(key)
		if err := os.Unsetenv(key); err != nil {
			t.Fatalf("unset %s: %v", key, err)
		}
		t.Cleanup(func() {
			if ok {
				_ = os.Setenv(key, value)
				return
			}
			_ = os.Unsetenv(key)
		})
	}
}
