package cmd

import "testing"

func TestValidateRedirectURIRequiresPort(t *testing.T) {
	_, err := validateRedirectURI("http://localhost/callback")
	if err == nil {
		t.Fatal("expected missing port to fail")
	}
}

func TestValidateRedirectURINormalizesEmptyPath(t *testing.T) {
	got, err := validateRedirectURI("http://localhost:8484")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "http://localhost:8484/" {
		t.Fatalf("unexpected normalized URI: %s", got)
	}
}
