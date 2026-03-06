package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	facebookauth "github.com/salmonumbrella/facebook-cli/internal/auth"
)

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
				addCheck("access_token", "fail", "no token resolved from override/env/profile")
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
				"tokenSource":    ternaryString(accessToken != "", "override/env/profile", "none"),
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
