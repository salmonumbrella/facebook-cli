package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/salmonumbrella/facebook-cli/internal/config"
	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

const iso8601MillisFormat = "2006-01-02T15:04:05.000Z07:00"

var facebookTokenPattern = regexp.MustCompile(`EAA[0-9A-Za-z]+`)

// DefaultLoginScopes mirrors the TypeScript auth CLI defaults.
var DefaultLoginScopes = []string{
	"public_profile",
	"pages_show_list",
	"pages_read_engagement",
	"pages_manage_posts",
	"ads_read",
	"ads_management",
	"business_management",
}

// HTTPClient is the minimal interface needed by the OAuth helpers.
type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

// Client provides stateful wrappers around the package-level OAuth helpers.
type Client struct {
	HTTP HTTPClient
}

// ExchangeCodeForTokenInput contains the authorization code exchange inputs.
type ExchangeCodeForTokenInput struct {
	AppID       string
	AppSecret   string
	RedirectURI string
	Code        string
	Version     string
}

// ExchangeForLongLivedTokenInput contains the long-lived token exchange inputs.
type ExchangeForLongLivedTokenInput struct {
	AppID       string
	AppSecret   string
	AccessToken string
	Version     string
}

// DebugTokenInput contains the debug_token endpoint inputs.
type DebugTokenInput struct {
	InputToken     string
	AppAccessToken string
	Version        string
}

// RedirectValidationResult mirrors the TS redirect validation helper.
type RedirectValidationResult struct {
	OK         bool
	Normalized string
	Error      string
}

// New returns an auth client with a sensible default HTTP client.
func New() *Client {
	return &Client{HTTP: &http.Client{Timeout: 30 * time.Second}}
}

// BuildFacebookOAuthURL returns the Facebook OAuth dialog URL.
func BuildFacebookOAuthURL(appID string, redirectURI string, state string, scopes []string, version string) string {
	u := &url.URL{
		Scheme: "https",
		Host:   "www.facebook.com",
		Path:   "/" + config.GraphAPIVersion(version) + "/dialog/oauth",
	}

	query := u.Query()
	query.Set("client_id", appID)
	query.Set("redirect_uri", redirectURI)
	query.Set("state", state)
	query.Set("scope", strings.Join(scopes, ","))
	u.RawQuery = query.Encode()

	return u.String()
}

// BuildAppAccessToken combines app ID and app secret in Facebook's expected form.
func BuildAppAccessToken(appID string, appSecret string) string {
	return appID + "|" + appSecret
}

// ComputeExpiresAt returns the ISO8601 expiry timestamp or an empty string when unset.
func ComputeExpiresAt(expiresIn int, now time.Time) string {
	if expiresIn <= 0 {
		return ""
	}
	if now.IsZero() {
		now = time.Now()
	}
	return now.UTC().Add(time.Duration(expiresIn) * time.Second).Format(iso8601MillisFormat)
}

// ExchangeCodeForToken exchanges an OAuth code for a Facebook user token.
func ExchangeCodeForToken(ctx context.Context, client HTTPClient, input ExchangeCodeForTokenInput) (map[string]any, error) {
	u := &url.URL{
		Scheme: "https",
		Host:   "graph.facebook.com",
		Path:   "/" + config.GraphAPIVersion(input.Version) + "/oauth/access_token",
	}
	query := u.Query()
	query.Set("client_id", input.AppID)
	query.Set("client_secret", input.AppSecret)
	query.Set("redirect_uri", input.RedirectURI)
	query.Set("code", input.Code)
	u.RawQuery = query.Encode()

	return doFacebookJSONRequest(ctx, client, u.String())
}

// ExchangeForLongLivedToken exchanges a short-lived token for a long-lived one.
func ExchangeForLongLivedToken(ctx context.Context, client HTTPClient, input ExchangeForLongLivedTokenInput) (map[string]any, error) {
	u := &url.URL{
		Scheme: "https",
		Host:   "graph.facebook.com",
		Path:   "/" + config.GraphAPIVersion(input.Version) + "/oauth/access_token",
	}
	query := u.Query()
	query.Set("grant_type", "fb_exchange_token")
	query.Set("client_id", input.AppID)
	query.Set("client_secret", input.AppSecret)
	query.Set("fb_exchange_token", input.AccessToken)
	u.RawQuery = query.Encode()

	return doFacebookJSONRequest(ctx, client, u.String())
}

// DebugToken calls Facebook's debug_token endpoint.
func DebugToken(ctx context.Context, client HTTPClient, input DebugTokenInput) (map[string]any, error) {
	u := &url.URL{
		Scheme: "https",
		Host:   "graph.facebook.com",
		Path:   "/" + config.GraphAPIVersion(input.Version) + "/debug_token",
	}
	query := u.Query()
	query.Set("input_token", input.InputToken)
	query.Set("access_token", input.AppAccessToken)
	u.RawQuery = query.Encode()

	return doFacebookJSONRequest(ctx, client, u.String())
}

// ExchangeCodeForToken is available as a method for callers that keep a Client.
func (c *Client) ExchangeCodeForToken(
	ctx context.Context,
	appID string,
	appSecret string,
	redirectURI string,
	code string,
	version string,
) (map[string]any, error) {
	return ExchangeCodeForToken(ctx, c.HTTP, ExchangeCodeForTokenInput{
		AppID:       appID,
		AppSecret:   appSecret,
		RedirectURI: redirectURI,
		Code:        code,
		Version:     version,
	})
}

// ExchangeForLongLivedToken is available as a method for callers that keep a Client.
func (c *Client) ExchangeForLongLivedToken(
	ctx context.Context,
	appID string,
	appSecret string,
	accessToken string,
	version string,
) (map[string]any, error) {
	return ExchangeForLongLivedToken(ctx, c.HTTP, ExchangeForLongLivedTokenInput{
		AppID:       appID,
		AppSecret:   appSecret,
		AccessToken: accessToken,
		Version:     version,
	})
}

// DebugToken is available as a method for callers that keep a Client.
func (c *Client) DebugToken(
	ctx context.Context,
	inputToken string,
	appAccessToken string,
	version string,
) (map[string]any, error) {
	return DebugToken(ctx, c.HTTP, DebugTokenInput{
		InputToken:     inputToken,
		AppAccessToken: appAccessToken,
		Version:        version,
	})
}

func doFacebookJSONRequest(ctx context.Context, client HTTPClient, rawURL string) (map[string]any, error) {
	if client == nil {
		client = http.DefaultClient
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}

	return parseFacebookJSONResponse(resp)
}

func parseFacebookJSONResponse(resp *http.Response) (map[string]any, error) {
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	data := map[string]any{}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &data); err != nil {
			if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
				return nil, fmt.Errorf("facebook auth request failed (%d)", resp.StatusCode)
			}
			return nil, err
		}
	}

	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return data, nil
	}

	if errorPayload, ok := data["error"].(map[string]any); ok {
		if message, ok := errorPayload["message"].(string); ok && message != "" {
			return nil, errors.New(message)
		}
	}

	return nil, fmt.Errorf("facebook auth request failed (%d)", resp.StatusCode)
}

// NormalizeScopes trims, deduplicates, and preserves scope order.
func NormalizeScopes(scopes []string) []string {
	seen := make(map[string]struct{}, len(scopes))
	out := make([]string, 0, len(scopes))

	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		if _, ok := seen[scope]; ok {
			continue
		}
		seen[scope] = struct{}{}
		out = append(out, scope)
	}

	return out
}

// DefaultScopes returns FB_OAUTH_SCOPES when set, otherwise the baked-in defaults.
func DefaultScopes(lookup func(string) (string, bool)) []string {
	if lookup == nil {
		lookup = os.LookupEnv
	}

	if value, ok := lookup("FB_OAUTH_SCOPES"); ok {
		parsed := NormalizeScopes(strings.Split(value, ","))
		if len(parsed) > 0 {
			return parsed
		}
	}

	return append([]string(nil), DefaultLoginScopes...)
}

// ResolveVersion applies explicit > env > default precedence.
func ResolveVersion(explicit string, lookup func(string) (string, bool)) string {
	if explicit != "" {
		return explicit
	}
	if lookup == nil {
		lookup = os.LookupEnv
	}
	if value, ok := lookup("FB_API_VERSION"); ok {
		return value
	}
	return config.DefaultGraphAPIVersion
}

// RequireAppCredentials validates that FB_APP_ID and FB_APP_SECRET are available.
func RequireAppCredentials(lookup func(string) (string, bool), operation string) (string, string, error) {
	if lookup == nil {
		lookup = os.LookupEnv
	}

	appID, okID := lookup("FB_APP_ID")
	appSecret, okSecret := lookup("FB_APP_SECRET")
	if !okID || !okSecret || appID == "" || appSecret == "" {
		return "", "", fmt.Errorf("FB_APP_ID and FB_APP_SECRET are required for auth %s", operation)
	}

	return appID, appSecret, nil
}

// ValidateLocalRedirectURI ensures the local callback uses http:// and includes a host.
func ValidateLocalRedirectURI(redirectURI string) RedirectValidationResult {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return RedirectValidationResult{
			OK:    false,
			Error: fmt.Sprintf("Invalid redirect URI: %s", redirectURI),
		}
	}

	if u.Scheme != "http" {
		return RedirectValidationResult{
			OK:    false,
			Error: "OAuth local callback currently supports only http:// redirect URIs (https is not supported here).",
		}
	}
	if u.Hostname() == "" {
		return RedirectValidationResult{
			OK:    false,
			Error: "Redirect URI must include a hostname.",
		}
	}

	return RedirectValidationResult{
		OK:         true,
		Normalized: u.String(),
	}
}

// TokenPreview returns the redacted token preview used by the TS auth CLI.
func TokenPreview(token string) string {
	if token == "" {
		return ""
	}

	redacted := redactToken(token)
	if redacted != token {
		return redacted
	}
	if len(token) <= 10 {
		prefixLength := 4
		if len(token) < prefixLength {
			prefixLength = len(token)
		}
		return token[:prefixLength] + "..."
	}

	return token[:6] + "..." + token[len(token)-4:]
}

func redactToken(input string) string {
	return facebookTokenPattern.ReplaceAllStringFunc(input, func(match string) string {
		if len(match) <= 10 {
			prefixLength := 6
			if len(match) < prefixLength {
				prefixLength = len(match)
			}
			return match[:prefixLength] + "..."
		}
		return match[:6] + "..." + match[len(match)-4:]
	})
}

// NewProfileAuthData builds the stored auth metadata for a Facebook OAuth token.
func NewProfileAuthData(expiresIn int, tokenType string, debugData map[string]any, now time.Time) *profile.AuthData {
	if now.IsZero() {
		now = time.Now()
	}

	auth := &profile.AuthData{
		Provider:   "facebook_oauth",
		ObtainedAt: now.UTC().Format(iso8601MillisFormat),
	}

	if expiresIn > 0 {
		expiresInCopy := expiresIn
		auth.ExpiresIn = &expiresInCopy
		auth.ExpiresAt = ComputeExpiresAt(expiresIn, now)
	}
	if tokenType != "" {
		auth.TokenType = tokenType
	}
	if scopes := extractStringSlice(debugData["scopes"]); len(scopes) > 0 {
		auth.Scopes = scopes
	}
	if userID, ok := debugData["user_id"].(string); ok {
		auth.UserID = userID
	}
	if appID, ok := debugData["app_id"].(string); ok {
		auth.AppID = appID
	}
	if isValid, ok := debugData["is_valid"].(bool); ok {
		isValidCopy := isValid
		auth.IsValid = &isValidCopy
	}

	return auth
}

func extractStringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}

	out := make([]string, 0, len(items))
	for _, item := range items {
		stringValue, ok := item.(string)
		if ok {
			out = append(out, stringValue)
		}
	}
	return out
}

// ClearStoredAuth removes the stored token and auth metadata for the selected profile.
func ClearStoredAuth(data *profile.StoreData, profileName string) {
	if data == nil {
		return
	}

	name := profileName
	if name == "" {
		name = data.Active
	}

	existing, ok := data.Profiles[name]
	if !ok {
		return
	}

	existing.AccessToken = ""
	existing.Auth = nil
	data.Profiles[name] = existing
}
