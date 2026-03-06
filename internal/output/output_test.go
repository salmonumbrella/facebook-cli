package output

import (
	"strings"
	"testing"
)

func TestWriteCSVForFlatObject(t *testing.T) {
	var builder strings.Builder
	err := Write(&builder, map[string]any{
		"authenticated": true,
		"profile":       "default",
	}, "csv")
	if err != nil {
		t.Fatalf("Write returned error: %v", err)
	}

	got := builder.String()
	if !strings.Contains(got, "authenticated,profile") {
		t.Fatalf("expected CSV headers, got %q", got)
	}
}

func TestWriteCSVForTypedNilField(t *testing.T) {
	var auth *struct{}
	var builder strings.Builder
	err := Write(&builder, map[string]any{
		"authenticated": false,
		"auth":          auth,
	}, "csv")
	if err != nil {
		t.Fatalf("Write returned error: %v", err)
	}

	got := builder.String()
	if !strings.Contains(got, "authenticated,auth") && !strings.Contains(got, "auth,authenticated") {
		t.Fatalf("expected CSV output, got %q", got)
	}
}

func TestWriteFallsBackToJSONForNestedObject(t *testing.T) {
	var builder strings.Builder
	err := Write(&builder, map[string]any{
		"profile": "default",
		"auth": map[string]any{
			"is_valid": true,
		},
	}, "table")
	if err != nil {
		t.Fatalf("Write returned error: %v", err)
	}

	got := builder.String()
	if !strings.Contains(got, "\"auth\"") {
		t.Fatalf("expected JSON output, got %q", got)
	}
}
