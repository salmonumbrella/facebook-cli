package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGraphDryRun(t *testing.T) {
	client := New("v25.0")
	client.DryRun = true

	result, err := client.Graph(context.Background(), http.MethodPost, "123/feed", "TOKEN", nil, map[string]any{
		"message": "hello",
	})
	if err != nil {
		t.Fatalf("Graph returned error: %v", err)
	}

	payload, ok := result.(map[string]any)
	if !ok {
		t.Fatalf("expected dry-run payload map, got %T", result)
	}
	if payload["dry_run"] != true {
		t.Fatalf("expected dry_run=true, got %#v", payload["dry_run"])
	}
}

func TestGraphBatchParsesBodies(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected POST, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"code": 200,
				"body": `{"ok":true}`,
			},
		})
	}))
	defer server.Close()

	client := New("v25.0")
	client.GraphURL = server.URL

	responses, err := client.GraphBatch(context.Background(), "TOKEN", []BatchRequest{
		{Method: http.MethodDelete, RelativeURL: "123"},
	})
	if err != nil {
		t.Fatalf("GraphBatch returned error: %v", err)
	}
	if len(responses) != 1 {
		t.Fatalf("expected 1 response, got %d", len(responses))
	}
	body, ok := responses[0].Body.(map[string]any)
	if !ok || body["ok"] != true {
		t.Fatalf("unexpected response body: %#v", responses[0].Body)
	}
}
