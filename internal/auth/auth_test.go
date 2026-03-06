package auth

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

type doFunc func(*http.Request) (*http.Response, error)

func (fn doFunc) Do(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestBuildFacebookOAuthURL(t *testing.T) {
	rawURL := BuildFacebookOAuthURL(
		"123",
		"http://localhost:8484/callback",
		"state123",
		[]string{"pages_manage_posts", "ads_management"},
		"v25.0",
	)

	if !strings.Contains(rawURL, "client_id=123") {
		t.Fatalf("expected client_id in %q", rawURL)
	}
	if !strings.Contains(rawURL, "state=state123") {
		t.Fatalf("expected state in %q", rawURL)
	}
	if !strings.Contains(rawURL, "scope=pages_manage_posts%2Cads_management") {
		t.Fatalf("expected scopes in %q", rawURL)
	}
}

func TestAuthHelpers(t *testing.T) {
	if got := BuildAppAccessToken("123", "secret"); got != "123|secret" {
		t.Fatalf("BuildAppAccessToken() = %q", got)
	}
	if got := ComputeExpiresAt(60, time.Unix(0, 0)); got != "1970-01-01T00:01:00.000Z" {
		t.Fatalf("ComputeExpiresAt() = %q", got)
	}
	if got := ComputeExpiresAt(0, time.Unix(0, 0)); got != "" {
		t.Fatalf("expected empty expiry for zero duration, got %q", got)
	}
}

func TestClearStoredAuth(t *testing.T) {
	expiresIn := 3600
	store := profile.StoreData{
		Active: "default",
		Profiles: map[string]profile.Data{
			"default": {
				AccessToken: "EAA1234",
				Auth: &profile.AuthData{
					Provider:  "facebook_oauth",
					ExpiresIn: &expiresIn,
				},
				Defaults: map[string]string{"page_id": "1"},
			},
		},
	}

	ClearStoredAuth(&store, "")

	if store.Profiles["default"].AccessToken != "" {
		t.Fatalf("expected token to be cleared")
	}
	if store.Profiles["default"].Auth != nil {
		t.Fatalf("expected auth metadata to be cleared")
	}
	if store.Profiles["default"].Defaults["page_id"] != "1" {
		t.Fatalf("expected defaults to be preserved")
	}
}

func TestOAuthHTTPHelpers(t *testing.T) {
	client := doFunc(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodGet {
			t.Fatalf("expected GET request, got %s", req.Method)
		}

		switch {
		case strings.Contains(req.URL.Path, "/debug_token"):
			if got := req.URL.Query().Get("input_token"); got != "long-token" {
				t.Fatalf("unexpected debug token input_token: %q", got)
			}
			return jsonResponse(http.StatusOK, `{"data":{"is_valid":true}}`), nil
		default:
			return jsonResponse(http.StatusOK, `{"access_token":"token","expires_in":3600}`), nil
		}
	})

	ctx := context.Background()

	byCode, err := ExchangeCodeForToken(ctx, client, ExchangeCodeForTokenInput{
		AppID:       "123",
		AppSecret:   "secret",
		RedirectURI: "http://localhost:8484/callback",
		Code:        "auth-code",
		Version:     "v25.0",
	})
	if err != nil {
		t.Fatalf("ExchangeCodeForToken() error = %v", err)
	}
	if byCode["access_token"] != "token" {
		t.Fatalf("unexpected code exchange response: %+v", byCode)
	}

	byExchange, err := ExchangeForLongLivedToken(ctx, client, ExchangeForLongLivedTokenInput{
		AppID:       "123",
		AppSecret:   "secret",
		AccessToken: "short-token",
		Version:     "v25.0",
	})
	if err != nil {
		t.Fatalf("ExchangeForLongLivedToken() error = %v", err)
	}
	if byExchange["access_token"] != "token" {
		t.Fatalf("unexpected long-lived exchange response: %+v", byExchange)
	}

	debug, err := DebugToken(ctx, client, DebugTokenInput{
		InputToken:     "long-token",
		AppAccessToken: "123|secret",
		Version:        "v25.0",
	})
	if err != nil {
		t.Fatalf("DebugToken() error = %v", err)
	}

	data, ok := debug["data"].(map[string]any)
	if !ok || data["is_valid"] != true {
		t.Fatalf("unexpected debug response: %+v", debug)
	}
}

func TestOAuthHTTPHelpersSurfaceFacebookErrors(t *testing.T) {
	client := doFunc(func(req *http.Request) (*http.Response, error) {
		return jsonResponse(http.StatusBadRequest, `{"error":{"message":"bad token"}}`), nil
	})

	_, err := ExchangeCodeForToken(context.Background(), client, ExchangeCodeForTokenInput{
		AppID:       "123",
		AppSecret:   "secret",
		RedirectURI: "http://localhost:8484/callback",
		Code:        "auth-code",
		Version:     "v25.0",
	})
	if err == nil || err.Error() != "bad token" {
		t.Fatalf("expected facebook error message, got %v", err)
	}
}

func TestAuthUtilityHelpers(t *testing.T) {
	scopes := NormalizeScopes([]string{" ads_read ", "ads_management", "ads_read", ""})
	if len(scopes) != 2 || scopes[0] != "ads_read" || scopes[1] != "ads_management" {
		t.Fatalf("unexpected scopes: %#v", scopes)
	}

	defaultScopes := DefaultScopes(func(name string) (string, bool) {
		if name == "FB_OAUTH_SCOPES" {
			return "pages_manage_posts, ads_read,pages_manage_posts", true
		}
		return "", false
	})
	if len(defaultScopes) != 2 {
		t.Fatalf("unexpected default scopes: %#v", defaultScopes)
	}

	appID, appSecret, err := RequireAppCredentials(func(name string) (string, bool) {
		switch name {
		case "FB_APP_ID":
			return "123", true
		case "FB_APP_SECRET":
			return "secret", true
		default:
			return "", false
		}
	}, "login")
	if err != nil || appID != "123" || appSecret != "secret" {
		t.Fatalf("unexpected app credentials result: %q %q %v", appID, appSecret, err)
	}

	validation := ValidateLocalRedirectURI("http://localhost:8484/callback")
	if !validation.OK || validation.Normalized != "http://localhost:8484/callback" {
		t.Fatalf("unexpected redirect validation: %+v", validation)
	}

	if preview := TokenPreview("EAA1234567890TOKEN"); !strings.Contains(preview, "...") {
		t.Fatalf("expected token preview to be redacted, got %q", preview)
	}
}

func TestNewProfileAuthData(t *testing.T) {
	now := time.Unix(0, 0)
	auth := NewProfileAuthData(7200, "bearer", map[string]any{
		"scopes":   []any{"ads_read", "ads_management"},
		"user_id":  "u_1",
		"app_id":   "123",
		"is_valid": true,
	}, now)

	if auth.Provider != "facebook_oauth" {
		t.Fatalf("unexpected provider: %+v", auth)
	}
	if auth.ExpiresAt != "1970-01-01T02:00:00.000Z" {
		t.Fatalf("unexpected expires_at: %q", auth.ExpiresAt)
	}
	if auth.IsValid == nil || !*auth.IsValid {
		t.Fatalf("expected is_valid to be true: %+v", auth)
	}
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
