package cmd

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"

	facebookauth "github.com/salmonumbrella/facebook-cli/internal/auth"
	"github.com/salmonumbrella/facebook-cli/internal/config"
	"github.com/salmonumbrella/facebook-cli/internal/profile"
)

var defaultLoginScopes = []string{
	"public_profile",
	"pages_show_list",
	"pages_read_engagement",
	"pages_manage_posts",
	"ads_read",
	"ads_management",
	"business_management",
}

func newAuthCommand(a *app) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Authentication commands",
	}

	cmd.AddCommand(newAuthLoginCommand(a))
	cmd.AddCommand(newAuthStatusCommand(a))
	cmd.AddCommand(newAuthLogoutCommand(a))
	cmd.AddCommand(newAuthRefreshCommand(a))
	cmd.AddCommand(newAuthDoctorCommand(a))
	return cmd
}

func newAuthLoginCommand(a *app) *cobra.Command {
	var (
		redirectURI string
		timeoutMS   int
		scopesCSV   string
		scopesList  []string
		noOpen      bool
		printOnly   bool
	)

	cmd := &cobra.Command{
		Use:   "login",
		Args:  cobra.NoArgs,
		Short: "Run the Facebook OAuth flow",
		RunE: func(cmd *cobra.Command, args []string) error {
			authClient := facebookauth.New()
			redirectURI = firstNonBlank(redirectURI, a.env.Get("FB_OAUTH_REDIRECT_URI"), "http://localhost:8484/callback")
			timeoutMS = firstNonZero(timeoutMS, parseOptionalInt(a.env.Get("FB_OAUTH_TIMEOUT_MS"), 180000))
			scopes := requestedScopes(a.env, scopesCSV, scopesList)
			redirectURI, err := validateRedirectURI(redirectURI)
			if err != nil {
				return err
			}

			appID := a.env.Get("FB_APP_ID")
			appSecret := a.env.Get("FB_APP_SECRET")
			if appID == "" || appSecret == "" {
				return errors.New("FB_APP_ID and FB_APP_SECRET are required for auth login")
			}

			state, err := randomState()
			if err != nil {
				return err
			}
			authURL := facebookauth.BuildFacebookOAuthURL(appID, redirectURI, state, scopes, a.runtime.APIVersion)
			if printOnly {
				return a.write(cmd, map[string]any{
					"ok":          true,
					"authUrl":     authURL,
					"redirectUri": redirectURI,
					"scopes":      scopes,
				})
			}

			_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Complete Facebook login in your browser:", authURL)
			browser := map[string]any{
				"attempted": !noOpen,
				"opened":    false,
			}
			if !noOpen {
				if err := openBrowser(authURL); err != nil {
					browser["error"] = err.Error()
					_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Could not open browser automatically:", err)
					_, _ = fmt.Fprintln(cmd.ErrOrStderr(), "Open the URL above manually.")
				} else {
					browser["opened"] = true
				}
			}

			callback, err := waitForOAuthCallback(cmd.Context(), redirectURI, state, time.Duration(timeoutMS)*time.Millisecond)
			if err != nil {
				return err
			}
			if callback.Error != "" {
				return fmt.Errorf("facebook authorization failed: %s", firstNonBlank(callback.ErrorDescription, callback.Error))
			}
			if callback.Code == "" {
				return errors.New("oauth callback did not include an authorization code")
			}
			if callback.State != state {
				return errors.New("oauth state mismatch")
			}

			shortLived, err := authClient.ExchangeCodeForToken(cmd.Context(), appID, appSecret, redirectURI, callback.Code, a.runtime.APIVersion)
			if err != nil {
				return err
			}
			shortToken := firstString(shortLived["access_token"])
			if shortToken == "" {
				return errors.New("facebook token exchange did not return access_token")
			}

			longLived, err := authClient.ExchangeForLongLivedToken(cmd.Context(), appID, appSecret, shortToken, a.runtime.APIVersion)
			if err != nil {
				return err
			}
			finalToken := firstNonBlank(firstString(longLived["access_token"]), shortToken)
			expiresIn := parseOptionalInt(firstString(longLived["expires_in"]), parseOptionalInt(firstString(shortLived["expires_in"]), 0))

			debugResponse, err := authClient.DebugToken(cmd.Context(), finalToken, facebookauth.BuildAppAccessToken(appID, appSecret), a.runtime.APIVersion)
			if err != nil {
				return err
			}

			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]
			profileData.AccessToken = finalToken
			profileData.Auth = buildProfileAuth(expiresIn, firstString(longLived["token_type"]), toMap(debugResponse["data"]))
			data.Profiles[a.runtime.ProfileName] = profileData
			data.Active = a.runtime.ProfileName
			if err := store.Save(data); err != nil {
				return err
			}

			return a.write(cmd, map[string]any{
				"ok":              true,
				"profile":         a.runtime.ProfileName,
				"redirectUri":     redirectURI,
				"scopesRequested": scopes,
				"scopesGranted":   toMap(debugResponse["data"])["scopes"],
				"expiresIn":       expiresIn,
				"expiresAt":       facebookauth.ComputeExpiresAt(expiresIn, time.Now()),
				"token":           tokenPreview(finalToken),
				"browser":         browser,
			})
		},
	}
	cmd.Flags().StringVar(&redirectURI, "redirect-uri", "", "OAuth redirect URI")
	cmd.Flags().IntVar(&timeoutMS, "timeout-ms", 0, "OAuth callback timeout in milliseconds")
	cmd.Flags().StringVar(&scopesCSV, "scopes", "", "Comma-separated scopes")
	cmd.Flags().StringArrayVar(&scopesList, "scope", nil, "Additional scope")
	cmd.Flags().BoolVar(&noOpen, "no-open", false, "Do not open the browser automatically")
	cmd.Flags().BoolVar(&printOnly, "print-only", false, "Print the auth URL without running the callback flow")
	return cmd
}

func newAuthStatusCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Args:  cobra.NoArgs,
		Short: "Show auth status",
		RunE: func(cmd *cobra.Command, args []string) error {
			_, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]
			return a.write(cmd, map[string]any{
				"authenticated": a.runtime.AccessToken != "",
				"profile":       a.runtime.ProfileName,
				"source":        ternaryString(a.runtime.AccessToken != "", "cli/env/profile", "none"),
				"token":         tokenPreview(a.runtime.AccessToken),
				"auth":          profileData.Auth,
			})
		},
	}
}

func newAuthLogoutCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "logout",
		Args:  cobra.NoArgs,
		Short: "Clear stored auth for the active profile",
		RunE: func(cmd *cobra.Command, args []string) error {
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			data = profile.ClearStoredAuth(data, a.runtime.ProfileName)
			if err := store.Save(data); err != nil {
				return err
			}
			return a.write(cmd, map[string]any{
				"ok":        true,
				"profile":   a.runtime.ProfileName,
				"loggedOut": true,
			})
		},
	}
}

func newAuthRefreshCommand(a *app) *cobra.Command {
	return &cobra.Command{
		Use:   "refresh",
		Args:  cobra.NoArgs,
		Short: "Refresh the stored token",
		RunE: func(cmd *cobra.Command, args []string) error {
			appID := a.env.Get("FB_APP_ID")
			appSecret := a.env.Get("FB_APP_SECRET")
			if appID == "" || appSecret == "" {
				return errors.New("FB_APP_ID and FB_APP_SECRET are required for auth refresh")
			}

			authClient := facebookauth.New()
			store, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]
			currentToken := firstNonBlank(profileData.AccessToken, a.runtime.AccessToken)
			if currentToken == "" {
				return errors.New("no stored access token to refresh. Run `auth login` first")
			}

			refreshed, err := authClient.ExchangeForLongLivedToken(cmd.Context(), appID, appSecret, currentToken, a.runtime.APIVersion)
			if err != nil {
				return err
			}
			newToken := firstNonBlank(firstString(refreshed["access_token"]), currentToken)
			expiresIn := parseOptionalInt(firstString(refreshed["expires_in"]), 0)
			debugResponse, err := authClient.DebugToken(cmd.Context(), newToken, facebookauth.BuildAppAccessToken(appID, appSecret), a.runtime.APIVersion)
			if err != nil {
				return err
			}

			profileData.AccessToken = newToken
			profileData.Auth = buildProfileAuth(expiresIn, firstString(refreshed["token_type"]), toMap(debugResponse["data"]))
			data.Profiles[a.runtime.ProfileName] = profileData
			data.Active = a.runtime.ProfileName
			if err := store.Save(data); err != nil {
				return err
			}

			return a.write(cmd, map[string]any{
				"ok":        true,
				"profile":   a.runtime.ProfileName,
				"expiresIn": expiresIn,
				"expiresAt": facebookauth.ComputeExpiresAt(expiresIn, time.Now()),
				"token":     tokenPreview(newToken),
			})
		},
	}
}

func newAuthDoctorCommand(a *app) *cobra.Command {
	var offline bool
	var scopesCSV string
	var scopesList []string

	cmd := &cobra.Command{
		Use:   "doctor",
		Args:  cobra.NoArgs,
		Short: "Validate auth setup",
		RunE: func(cmd *cobra.Command, args []string) error {
			checks := []map[string]any{}
			requiredScopes := requestedScopes(a.env, scopesCSV, scopesList)
			redirectURI := firstNonBlank(a.env.Get("FB_OAUTH_REDIRECT_URI"), "http://localhost:8484/callback")
			appID := a.env.Get("FB_APP_ID")
			appSecret := a.env.Get("FB_APP_SECRET")
			accessToken := a.runtime.AccessToken

			_, data, err := a.loadProfileStore()
			if err != nil {
				return err
			}
			profileData := data.Profiles[a.runtime.ProfileName]

			addCheck := func(name string, status string, details string) {
				checks = append(checks, map[string]any{
					"name":    name,
					"status":  status,
					"details": details,
				})
			}

			addCheck("profile_store", "pass", fmt.Sprintf("using %s (active: %s)", a.runtime.ProfilePath, a.runtime.ProfileName))
			if appID != "" {
				addCheck("app_id", "pass", "FB_APP_ID is set")
			} else {
				addCheck("app_id", "fail", "FB_APP_ID is missing")
			}
			if appSecret != "" {
				addCheck("app_secret", "pass", "FB_APP_SECRET is set")
			} else {
				addCheck("app_secret", "fail", "FB_APP_SECRET is missing")
			}
			if normalized, err := validateRedirectURI(redirectURI); err == nil {
				addCheck("oauth_redirect_uri", "pass", "configured redirect: "+normalized)
				redirectURI = normalized
			} else {
				addCheck("oauth_redirect_uri", "fail", err.Error())
			}
			if accessToken != "" {
				addCheck("access_token", "pass", "token available ("+tokenPreview(accessToken)+")")
			} else {
				addCheck("access_token", "fail", "no token resolved from cli/env/profile")
			}

			if accessToken != "" {
				if offline {
					addCheck("token_debug", "warn", "skipped token introspection because --offline was set")
				} else if appID == "" || appSecret == "" {
					addCheck("token_debug", "warn", "cannot debug token without FB_APP_ID and FB_APP_SECRET")
				} else {
					authClient := facebookauth.New()
					debugResponse, err := authClient.DebugToken(cmd.Context(), accessToken, facebookauth.BuildAppAccessToken(appID, appSecret), a.runtime.APIVersion)
					if err != nil {
						addCheck("token_debug", "fail", "debug_token failed: "+err.Error())
					} else {
						debugData := toMap(debugResponse["data"])
						isValid, _ := debugData["is_valid"].(bool)
						if isValid {
							addCheck("token_valid", "pass", "token is valid")
						} else {
							addCheck("token_valid", "fail", "token is invalid")
						}

						grantedScopes := toStringSlice(debugData["scopes"])
						missingScopes := []string{}
						for _, scope := range requiredScopes {
							if !containsString(grantedScopes, scope) {
								missingScopes = append(missingScopes, scope)
							}
						}
						if len(missingScopes) == 0 {
							addCheck("token_scopes", "pass", "all required scopes are present")
						} else {
							addCheck("token_scopes", "fail", "missing scopes: "+strings.Join(missingScopes, ", "))
						}

						if expiresAt := firstString(debugData["expires_at"]); expiresAt != "" {
							addCheck("token_expiry", "pass", "expires_at: "+expiresAt)
						}
					}
				}
			}

			failCount := 0
			warnCount := 0
			nextSteps := []string{}
			for _, check := range checks {
				switch check["status"] {
				case "fail":
					failCount++
				case "warn":
					warnCount++
				}
			}
			if appID == "" || appSecret == "" {
				nextSteps = append(nextSteps, "Set FB_APP_ID and FB_APP_SECRET in your environment or .env")
			}
			if accessToken == "" {
				nextSteps = append(nextSteps, "Run `fbcli auth login` to store a token in your active profile")
			}
			if _, err := validateRedirectURI(redirectURI); err != nil {
				nextSteps = append(nextSteps, "Set FB_OAUTH_REDIRECT_URI to a valid local http:// callback URL")
			}
			for _, check := range checks {
				if check["name"] == "token_scopes" && check["status"] == "fail" {
					nextSteps = append(nextSteps, "Re-run `fbcli auth login --scopes ...` with required permissions")
					break
				}
			}
			for _, check := range checks {
				if check["name"] == "token_debug" && check["status"] == "warn" {
					nextSteps = append(nextSteps, "Run `fbcli auth doctor` without --offline to verify token with Facebook")
					break
				}
			}
			if !offline && warnCount > 0 {
				nextSteps = append(nextSteps, "Run `fbcli auth doctor` without --offline to verify token with Facebook")
			}

			return a.write(cmd, map[string]any{
				"ok":             failCount == 0,
				"profile":        a.runtime.ProfileName,
				"tokenSource":    ternaryString(accessToken != "", "cli/env/profile", "none"),
				"resolvedToken":  tokenPreview(accessToken),
				"requiredScopes": requiredScopes,
				"storedAuth":     profileData.Auth,
				"checks":         checks,
				"summary": map[string]any{
					"pass": len(checks) - warnCount - failCount,
					"warn": warnCount,
					"fail": failCount,
				},
				"nextSteps": nextSteps,
			})
		},
	}
	cmd.Flags().BoolVar(&offline, "offline", false, "Skip token introspection")
	cmd.Flags().StringVar(&scopesCSV, "scopes", "", "Comma-separated scopes")
	cmd.Flags().StringArrayVar(&scopesList, "scope", nil, "Additional scope")
	return cmd
}

type oauthCallback struct {
	Code             string
	State            string
	Error            string
	ErrorDescription string
}

func waitForOAuthCallback(ctx context.Context, redirectURI string, expectedState string, timeout time.Duration) (oauthCallback, error) {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return oauthCallback{}, err
	}
	resultCh := make(chan oauthCallback, 1)
	server := &http.Server{}
	server.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != parsed.Path {
			http.NotFound(w, r)
			return
		}
		callback := oauthCallback{
			Code:             r.URL.Query().Get("code"),
			State:            r.URL.Query().Get("state"),
			Error:            r.URL.Query().Get("error"),
			ErrorDescription: r.URL.Query().Get("error_description"),
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		switch {
		case callback.Error != "" || callback.Code == "":
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("<h1>Facebook login failed.</h1><p>You can close this window.</p>"))
		case callback.State != expectedState:
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("<h1>OAuth state mismatch.</h1><p>You can close this window.</p>"))
		default:
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("<h1>Login complete.</h1><p>You can close this window and return to your terminal.</p>"))
		}
		select {
		case resultCh <- callback:
		default:
		}
		go func() { _ = server.Shutdown(context.Background()) }()
	})

	listenAddr := parsed.Host
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return oauthCallback{}, fmt.Errorf("failed to start OAuth callback server on port %s: %w", parsed.Port(), err)
	}
	defer func() { _ = listener.Close() }()

	go func() {
		_ = server.Serve(listener)
	}()

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		_ = server.Shutdown(context.Background())
		return oauthCallback{}, ctx.Err()
	case <-timer.C:
		_ = server.Shutdown(context.Background())
		return oauthCallback{}, fmt.Errorf("OAuth callback timed out after %s. Open the auth URL and complete login, then ensure your browser can reach %s", timeout, redirectURI)
	case callback := <-resultCh:
		return callback, nil
	}
}

func openBrowser(rawURL string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", rawURL)
	case "windows":
		command = exec.Command("cmd", "/c", "start", "", rawURL)
	default:
		command = exec.Command("xdg-open", rawURL)
	}
	return command.Start()
}

func requestedScopes(env *config.Env, csv string, list []string) []string {
	if envScopes := normalizeScopes(strings.Split(env.Get("FB_OAUTH_SCOPES"), ",")); len(envScopes) > 0 && csv == "" && len(list) == 0 {
		return envScopes
	}
	base := defaultLoginScopes
	if csv != "" {
		base = normalizeScopes(strings.Split(csv, ","))
	}
	base = append(base, list...)
	scopes := normalizeScopes(base)
	if len(scopes) == 0 {
		return defaultLoginScopes
	}
	return scopes
}

func normalizeScopes(scopes []string) []string {
	seen := map[string]struct{}{}
	out := []string{}
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

func validateRedirectURI(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid redirect URI: %s", raw)
	}
	if parsed.Scheme != "http" {
		return "", errors.New("OAuth local callback currently supports only http:// redirect URIs (https is not supported here)")
	}
	if parsed.Hostname() == "" {
		return "", errors.New("redirect URI must include a hostname")
	}
	if parsed.Port() == "" {
		return "", errors.New("redirect URI must include an explicit port")
	}
	if parsed.Path == "" {
		parsed.Path = "/"
	}
	return parsed.String(), nil
}

func randomState() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func tokenPreview(token string) string {
	if token == "" {
		return ""
	}
	if strings.HasPrefix(token, "EAA") && len(token) > 10 {
		return token[:6] + "..." + token[len(token)-4:]
	}
	if len(token) <= 10 {
		return token[:4] + "..."
	}
	return token[:6] + "..." + token[len(token)-4:]
}

func buildProfileAuth(expiresIn int, tokenType string, debugData map[string]any) *profile.AuthData {
	isValid, hasValid := debugData["is_valid"].(bool)
	var expiresInValue *int
	if expiresIn > 0 {
		expiresInCopy := expiresIn
		expiresInValue = &expiresInCopy
	}
	authData := &profile.AuthData{
		Provider:   "facebook_oauth",
		ObtainedAt: time.Now().UTC().Format(time.RFC3339),
		ExpiresAt:  facebookauth.ComputeExpiresAt(expiresIn, time.Now()),
		ExpiresIn:  expiresInValue,
		TokenType:  tokenType,
		Scopes:     toStringSlice(debugData["scopes"]),
		UserID:     firstString(debugData["user_id"]),
		AppID:      firstString(debugData["app_id"]),
	}
	if hasValid {
		authData.IsValid = &isValid
	}
	return authData
}

func toStringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok {
			out = append(out, text)
		}
	}
	return out
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func firstNonZero(values ...int) int {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

func ternaryString(condition bool, whenTrue string, whenFalse string) string {
	if condition {
		return whenTrue
	}
	return whenFalse
}
