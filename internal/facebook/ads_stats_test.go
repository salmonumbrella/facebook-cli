package facebook

import "testing"

func TestToNumberParsesString(t *testing.T) {
	got := toNumber("123.45")
	if got != 123.45 {
		t.Fatalf("expected 123.45, got %v", got)
	}
}

func TestAnalyzeStatsHandlesStringNumbers(t *testing.T) {
	result := AnalyzeStats([]map[string]any{
		{"impressions": "10", "clicks": "2", "spend": "1.5", "ctr": "0.2", "cpc": "0.75", "cpm": "150"},
		{"impressions": "20", "clicks": "4", "spend": "3.0", "ctr": "0.2", "cpc": "0.75", "cpm": "150"},
	})
	impressions := result["impressions"].(map[string]any)
	if impressions["max"] != 20.0 {
		t.Fatalf("expected max impressions 20, got %#v", impressions["max"])
	}
}
