package profile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadMissingFileReturnsDefaultStore(t *testing.T) {
	store := NewStore(filepath.Join(t.TempDir(), "profiles.json"))

	data, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if data.Active != DefaultProfileName {
		t.Fatalf("expected default active profile, got %q", data.Active)
	}
	if _, ok := data.Profiles[DefaultProfileName]; !ok {
		t.Fatalf("expected default profile entry")
	}
}

func TestLoadRejectsInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "profiles.json")
	if err := os.WriteFile(path, []byte("{"), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	_, err := NewStore(path).Load()
	if err == nil || err.Error() != "profile store '"+path+"' is not valid JSON" {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLoadRejectsInvalidShape(t *testing.T) {
	path := filepath.Join(t.TempDir(), "profiles.json")
	if err := os.WriteFile(path, []byte(`{"active":"default","profiles":[]}`), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	_, err := NewStore(path).Load()
	if err == nil || !strings.Contains(err.Error(), "invalid shape") {
		t.Fatalf("expected invalid shape error, got %v", err)
	}
}

func TestLoadEnsuresActiveProfileExists(t *testing.T) {
	path := filepath.Join(t.TempDir(), "profiles.json")
	if err := os.WriteFile(path, []byte(`{"active":"work","profiles":{"default":{}}}`), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	data, err := NewStore(path).Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if _, ok := data.Profiles["work"]; !ok {
		t.Fatalf("expected active profile to be backfilled")
	}
}

func TestSaveRoundTripAndPermissions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "profiles.json")
	store := NewStore(path)
	expiresIn := 3600
	isValid := true

	want := StoreData{
		Active: "work",
		Profiles: map[string]Data{
			"work": {
				AccessToken: "token",
				Defaults: map[string]string{
					"page_id": "1",
				},
				Auth: &AuthData{
					Provider:  "facebook_oauth",
					ExpiresIn: &expiresIn,
					IsValid:   &isValid,
				},
			},
		},
	}

	if err := store.Save(want); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat() error = %v", err)
	}
	if perms := info.Mode().Perm(); perms != 0o600 {
		t.Fatalf("expected 0600 permissions, got %o", perms)
	}

	got, err := store.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got.Active != "work" || got.Profiles["work"].AccessToken != "token" {
		t.Fatalf("unexpected round trip data: %+v", got)
	}
	if got.Profiles["work"].Auth == nil || got.Profiles["work"].Auth.Provider != "facebook_oauth" {
		t.Fatalf("expected auth metadata to round trip: %+v", got.Profiles["work"].Auth)
	}
}
